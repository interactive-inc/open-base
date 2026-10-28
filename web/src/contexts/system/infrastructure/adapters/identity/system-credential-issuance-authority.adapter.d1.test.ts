import { expect, setDefaultTimeout, test } from "bun:test"
import { SystemCredentialIssuanceAuthorityAdapter } from "@system/infrastructure/adapters/identity/system-credential-issuance-authority.adapter"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"

setDefaultTimeout(30_000)
const actorAccountId = "11111111-1111-4111-8111-111111111111"
const accountId = "22222222-2222-4222-8222-222222222222"
const actorRoleId = "33333333-3333-4333-8333-333333333333"
const targetRoleId = "44444444-4444-4444-8444-444444444444"
const now = new Date("2026-01-01T00:00:00Z")

for (const scenario of [
  "missing",
  "scoped",
  "allowed",
  "admin",
  "revoked",
  "promoted",
  "scoped-role",
  "future-role",
] as const) {
  test(`資格の発行権限を保存時にも検査する（${scenario}）`, async () => {
    const { database } = await SystemSessionTestContext.create()
    await execSql(
      database,
      `
      INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('${actorAccountId}', 'active', 0, 0, 0), ('${accountId}', 'active', 0, 0, 0);
      INSERT INTO system_iam_roles (id, key, kind, name, resource_type, created_at, updated_at)
      VALUES ('${actorRoleId}', 'issuer', 'custom', 'Issuer', ${scenario === "scoped-role" ? "'document'" : "NULL"}, ${scenario === "future-role" ? now.getTime() + 1000 : 0}, ${scenario === "future-role" ? now.getTime() + 1000 : 0}), ('${targetRoleId}', 'recipient', 'custom', 'Recipient', NULL, 0, 0);
      INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('${actorRoleId}', 'iam:write'), ('${targetRoleId}', 'records:read');
      INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at)
      VALUES ('55555555-5555-4555-8555-555555555555', '${actorAccountId}', '${actorRoleId}', NULL, NULL, 0),
             ('66666666-6666-4666-8666-666666666666', '${accountId}', '${targetRoleId}', ${scenario === "scoped" ? "'document', 'document-one'" : "NULL, NULL"}, 0);
    `,
    )
    if (["allowed", "revoked", "promoted", "scoped-role", "future-role"].includes(scenario)) {
      await database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, 'records:read')",
        )
        .bind(actorRoleId)
        .run()
    }
    if (scenario === "admin") {
      await database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, 'system:admin')",
        )
        .bind(actorRoleId)
        .run()
    }
    const adapter = new SystemCredentialIssuanceAuthorityAdapter(database)
    const input = { actorAccountId, accountId, now, allowSelf: false }
    expect(await adapter.canIssue(input)).toBe(
      !["missing", "scoped", "scoped-role", "future-role"].includes(scenario),
    )
    if (scenario === "revoked")
      await database
        .prepare("UPDATE system_role_bindings SET revoked_at = ?1 WHERE account_id = ?2")
        .bind(now.getTime(), actorAccountId)
        .run()
    if (scenario === "promoted")
      await database
        .prepare(
          "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, 'records:write')",
        )
        .bind(targetRoleId)
        .run()
    const guard = adapter.prepare(input).toSQL()
    const save = database.batch([
      database.prepare(guard.sql).bind(...guard.params),
      database
        .prepare("UPDATE system_accounts SET token_version = token_version + 1 WHERE id = ?1")
        .bind(accountId),
    ])
    const allowed = scenario === "allowed" || scenario === "admin"
    if (allowed) await save
    else await expect(save).rejects.toThrow("integer overflow")
    expect(
      await database
        .prepare("SELECT token_version AS version FROM system_accounts WHERE id = ?1")
        .bind(accountId)
        .first<number>("version"),
    ).toBe(allowed ? 1 : 0)
  })
}
