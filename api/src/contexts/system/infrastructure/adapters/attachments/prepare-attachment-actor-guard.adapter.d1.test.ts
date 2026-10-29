import { expect, test } from "bun:test"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { PrepareAttachmentActorGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-actor-guard.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

test("渡した評価時刻が古くてもSQL実行時のcredential期限を検査する", async () => {
  const database = await createSystemAttachmentTestDatabase()
  const now = Date.now()
  const accountId = zAccountId.parse(crypto.randomUUID())
  const principalId = crypto.randomUUID()
  const credentialId = crypto.randomUUID()
  await database.batch([
    database
      .prepare(
        "INSERT INTO system_accounts(id,status,created_at,updated_at) VALUES (?1,'active',0,0)",
      )
      .bind(accountId),
    database
      .prepare(
        "INSERT INTO system_principals(id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,'agent','Example',1,0,0)",
      )
      .bind(principalId, accountId),
    database
      .prepare(
        "INSERT INTO system_machine_credentials(id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at,expires_at) VALUES (?1,?2,'Example',?3,'active',0,?4,?4,?5)",
      )
      .bind(credentialId, principalId, "a".repeat(64), now - 20_000, now - 5000),
  ])
  const assertions = new PrepareAttachmentActorGuardAdapter({ env: { DB: database } }).prepare({
    authentication: {
      accountId,
      tokenVersion: 0,
      issuedAtMs: now - 20_000,
      expiresAtMs: now + 60_000,
      machineCredentialId: credentialId,
      identityBindingId: null,
      sessionFamilyId: null,
    },
    at: new Date(now - 10_000),
    rejection: "attachment_upload_actor_changed",
  })
  const rejected = await database.batch([...assertions]).catch((cause: unknown) => cause)
  expect(rejected).toBeInstanceOf(Error)
  expect(PrepareAttachmentActorGuardAdapter.isUploadRejected(rejected)).toBe(true)
})
