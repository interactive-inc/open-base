import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { PreparePreservedRecordDossierAuthorizationAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-dossier-authorization.adapter"
import { SystemAuditDisclosurePolicyRepository } from "@system/infrastructure/repositories/audit/system-audit-disclosure-policy.repository"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { auditDisclosureFieldSchema } from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("監査出力資格は期限の1ms前まで有効で、期限ちょうどの最終transactionを拒否する", async () => {
  const db = await createSystemAttachmentTestDatabase()
  await execSql(
    db,
    `INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES ('70e2091f-b34d-4e08-abad-533415c4908c','active',0,100,100);
    INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES ('f10132a2-99c0-4174-8625-482ce8675ac8','70e2091f-b34d-4e08-abad-533415c4908c','human','Test operator',1,100,100);
    INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES ('44ac46b5-401f-4901-8c48-f29310b8c981','role:operator','custom','Test role',100,100);
    INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES ('3b967b89-82b6-4e5d-8f67-ad4f2fb3a7ae','70e2091f-b34d-4e08-abad-533415c4908c','44ac46b5-401f-4901-8c48-f29310b8c981',100);
    INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES
      ('44ac46b5-401f-4901-8c48-f29310b8c981','system:admin'),('44ac46b5-401f-4901-8c48-f29310b8c981','system:record:export'),('44ac46b5-401f-4901-8c48-f29310b8c981','system:procedure:read');`,
  )
  const at = new Date()
  const expiresAt = new Date(Math.floor(at.getTime() / 1000) * 1000 + 60007)
  const policy = SystemAuditDisclosurePolicyEntity.create({
    scope: "70e2091f-b34d-4e08-abad-533415c4908c",
    commandId: crypto.randomUUID(),
    revision: 1,
    enabled: true,
    allowedFields: auditDisclosureFieldSchema.options,
    allowedTargetTypes: null,
    allowedPurposes: ["archive"],
    expiresAt: expiresAt.toISOString(),
    reason: "Temporary archive access",
    actorAccountId: "70e2091f-b34d-4e08-abad-533415c4908c",
    recordedAt: at.toISOString(),
    auditEventId: crypto.randomUUID(),
  })
  if (policy instanceof Error) throw policy
  const appended = await new SystemAuditDisclosurePolicyRepository({
    env: { DB: db },
    assertions: [db.prepare("SELECT 1")],
  }).append(policy, null)
  if (appended instanceof Error) throw appended
  const reader = new PreparePreservedRecordDossierAuthorizationAdapter({
    env: { DB: db },
    purpose: "archive",
    authentication: {
      accountId: zAccountId.parse("70e2091f-b34d-4e08-abad-533415c4908c"),
      tokenVersion: 0,
      issuedAtMs: at.getTime() - 1000,
      expiresAtMs: expiresAt.getTime() + 60000,
      machineCredentialId: null,
      identityBindingId: null,
    },
  })
  const proof = await reader.prepare(at)
  if (proof instanceof Error) throw proof
  const before = proof.assertions(new Date(expiresAt.getTime() - 1))
  if (before instanceof Error) throw before
  await db.batch(before)
  for (const offset of [0, 1]) {
    const expired = proof.assertions(new Date(expiresAt.getTime() + offset))
    if (expired instanceof Error) throw expired
    expect(await db.batch(expired).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(await reader.prepare(new Date(expiresAt.getTime() + offset))).toBeInstanceOf(Error)
  }
  await execSql(
    db,
    "DELETE FROM system_iam_role_permissions WHERE role_id = '44ac46b5-401f-4901-8c48-f29310b8c981' AND permission_key = 'system:admin'",
  )
  const revoked = proof.assertions(at)
  if (revoked instanceof Error) throw revoked
  expect(await db.batch(revoked).catch((cause: unknown) => cause)).toBeInstanceOf(Error)
  expect(await reader.prepare(at)).toBeInstanceOf(Error)
})
