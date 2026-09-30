import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { ApplyExternalIdentities } from "@/contexts/company/application/external-identities/apply-external-identities"
import { ExternalIdentityImportRepository } from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import type { ExternalIdentityImportInput } from "@/contexts/company/domain/entities/external-identity-import.entity"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.machine-sessions"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { alignHistoricalOrganizationIdentity } from "@/contexts/company/test/align-historical-organization-identity.test-support"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
export const EXTERNAL_IMPORT_TEST_SECRET = "external-import-test-signing-secret"

/** 両製品の実migrationと機械session発行を使うCompany同期fixture。 */
export async function createExternalIdentityImportTestContext(
  providerScope = "oidc",
  given?: D1Database,
) {
  const database = given ?? (await createLocalD1Database({ schema: schemaSql }))
  const now = new Date()
  const accountId = zAccountId.parse("26c690b3-a723-4977-b299-36862160bfce")
  const credentialId = "a5a88835-2a43-4022-bc5c-370a679ccb3c"
  const rawSecret = "1".repeat(64)
  const hash = await new SystemPrincipalSecretService().hashRawSecret(rawSecret)
  if (hash instanceof Error) throw hash
  await alignHistoricalOrganizationIdentity(database)
  // role の主キーを UUID へ移す前の schema では、migration が入れた管理 role の主キーが UUID でない。
  // 取り込みは role の一覧を検証して読むため、どの割当も指していない旧来の role を先に外す。
  await execSql(
    database,
    `
    DELETE FROM system_iam_roles
    WHERE length(id) <> 36 AND id NOT IN (SELECT role_id FROM system_role_bindings);
  `,
  )
  // 記録の table に UUID の代理キーを足す前の schema では id の列が無い。現行の書込みは drizzle の
  // 定義どおり id を渡すため、検査用に空の列だけを足す。後続の migration の作り直しで主キーになる。
  for (const table of [
    "company_command_receipts",
    "company_resource_heads",
    "company_resource_revisions",
    "company_account_profiles",
  ]) {
    const columns = await database
      .prepare(`SELECT name FROM pragma_table_info('${table}')`)
      .all<{ name: string }>()
    if (columns.results.length > 0 && !columns.results.some((column) => column.name === "id"))
      await execSql(database, `ALTER TABLE ${table} ADD COLUMN id TEXT`)
  }
  // 主キーを UUID へ移す前の schema には旧 ID の列が無い。現行の System の読取は列を選ぶため、空の列だけを足す。
  for (const table of ["system_accounts", "system_principals"]) {
    const columns = await database
      .prepare(`SELECT name FROM pragma_table_info('${table}')`)
      .all<{ name: string }>()
    if (
      columns.results.length > 0 &&
      !columns.results.some((column) => column.name === "legacy_id")
    )
      await execSql(database, `ALTER TABLE ${table} ADD COLUMN legacy_id TEXT`)
  }
  await execSql(
    database,
    `
    INSERT INTO company_organizations (id, revision, name, representative_name, created_at, updated_at)
      SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}', 0, 'Example organization', 'Example representative', 0, 0
      WHERE NOT EXISTS (SELECT 1 FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}');
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('26c690b3-a723-4977-b299-36862160bfce', 'active', 0, 0, 0);
    INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('4eaf6317-da6a-455b-9025-8f0615ccbeaf', '26c690b3-a723-4977-b299-36862160bfce', 'service', 'Directory synchronization', NULL, 1, 0, 0);
    INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
      VALUES ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'custom:import-global', 'custom', NULL, 'Account grants', 0, 0),
        ('8ca6d30f-174b-40e1-870b-df888721f554', 'custom:import-provider', 'custom', 'system:identity_provider', 'Provider writer', 0, 0),
        ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'custom:import-member', 'custom', NULL, 'Imported member', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'iam:write'), ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'org:read'), ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'employee:read'),
        ('8ca6d30f-174b-40e1-870b-df888721f554', 'account:manage'), ('8ca6d30f-174b-40e1-870b-df888721f554', 'employee:write'),
        ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'org:read'), ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'employee:read');
    INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
      VALUES ('b63cf0e2-c63e-4834-8bc0-840f72f13aa4', '26c690b3-a723-4977-b299-36862160bfce', 'ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', NULL, NULL, 0, NULL);
  `,
  )
  await database
    .prepare(`INSERT INTO system_role_bindings
    (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
    VALUES ('721e4694-365f-47cd-8983-0743ec63c76d', '26c690b3-a723-4977-b299-36862160bfce', '8ca6d30f-174b-40e1-870b-df888721f554', 'system:identity_provider', ?1, 0, NULL)`)
    .bind(providerScope)
    .run()
  await database
    .prepare(`INSERT INTO system_machine_credentials
    (id, principal_id, name, secret_hash, status, created_at, updated_at)
    VALUES (?1, '4eaf6317-da6a-455b-9025-8f0615ccbeaf', 'Primary', ?2, 'active', 0, 0)`)
    .bind(credentialId, hash)
    .run()
  const app = systemFactory.createApp().post("/system/machine-sessions", ...POST)
  const response = await app.request(
    "/system/machine-sessions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential_id: credentialId, secret: rawSecret }),
    },
    { DB: database, JWT_SECRET: EXTERNAL_IMPORT_TEST_SECRET, NOW: now.toISOString() },
  )
  if (response.status !== 201)
    throw new Error(`machine session failed: ${response.status} ${await response.text()}`)
  const token = z.object({ access_token: z.string() }).parse(await response.json()).access_token
  const revision = await database
    .prepare(
      `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .first<number>("revision")
  if (revision === null) throw new Error("missing organization")
  const actor = { accountId, tokenVersion: 0, credentialId, issuedAtMs: now.getTime() }
  const clock = { at: now }
  const application = new ApplyExternalIdentities({
    repository: new ExternalIdentityImportRepository({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    }),
    actor,
    now: () => clock.at,
  })
  const input: ExternalIdentityImportInput = {
    commandId: "import:first",
    expectedRevision: revision,
    reason: "Confirmed directory update",
    identities: [
      {
        subject: "external-person-1",
        sourceRevision: 1,
        email: "you@example.com",
        name: "Example Person",
        accountId: null,
        initialRoleId: iamRoleIdSchema.parse("1f178fc9-9b4d-4247-8dc8-8f1344bf445d"),
        newEmployee: { hireDate: "2026-01-01", employmentType: "PART_TIME" },
      },
    ],
  }
  return { database, actor, token, clock, application, input }
}
