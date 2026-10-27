import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { passwordResetTokenHashSchema } from "@system/domain/schemas/auth/password-reset-token-hash.schema"
import { CreatePendingSystemPasswordIdentityAdapter } from "@system/infrastructure/adapters/identity/create-pending-system-password-identity.adapter"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const operatorAccountId = "3c9a1f2e-5b6d-4e7f-8a9b-0c1d2e3f4a51"
const targetAccountId = "4d0b2a3f-6c7e-4f80-9bac-1d2e3f4a5b62"

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('${operatorAccountId}', 'active', 0, 1, 1),
            ('${targetAccountId}', 'active', 0, 1, 1);
     INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
     VALUES ('5e1c3b4a-7d8f-4091-8cbd-2e3f4a5b6c73', 'system:root', 'managed', 'System root', 1, 1);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('5e1c3b4a-7d8f-4091-8cbd-2e3f4a5b6c73', 'system:admin');`,
  )

  return fixture
}

/** 事前読取の後に、別の管理者が対象へrootを付与した状態を作る。 */
async function grantRoot(fixture: SystemSessionTestContext, accountId: string): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES (?1, ?2, '5e1c3b4a-7d8f-4091-8cbd-2e3f4a5b6c73', NULL, NULL, 1, NULL)`)
    .bind(crypto.randomUUID(), accountId)
    .run()
}

function createPending(
  fixture: SystemSessionTestContext,
  input: Readonly<{ actorAccountId: string; requesterHasSystemAdmin: boolean; email: string }>,
) {
  return new CreatePendingSystemPasswordIdentityAdapter(
    fixture.context,
  ).createPendingSystemPasswordIdentity({
    actorAccountId: input.actorAccountId,
    requesterHasSystemAdmin: input.requesterHasSystemAdmin,
    accountId: targetAccountId,
    email: input.email,
    pendingPasswordHash: "pending-password-hash-placeholder",
    tokenHash: passwordResetTokenHashSchema.parse(
      crypto.randomUUID().replaceAll("-", "").repeat(2),
    ),
    now,
    expiresAt: new Date(now.getTime() + 3_600_000),
    metadataJson: null,
  })
}

async function countWrites(fixture: SystemSessionTestContext) {
  return await fixture.database
    .prepare(`SELECT
         (SELECT count(*) FROM system_identity_bindings WHERE account_id = ?1) AS identities,
         (SELECT count(*) FROM system_password_reset_challenges WHERE account_id = ?1) AS challenges,
         (SELECT count(*) FROM system_audit_events) AS audits,
         (SELECT token_version FROM system_accounts WHERE id = ?1) AS tokenVersion`)
    .bind(targetAccountId)
    .first<Record<string, unknown>>()
}

describe("CreatePendingSystemPasswordIdentityAdapter", () => {
  test("読取後に対象がrootを得たら、system:adminでない操作者の追加はbatchごと取り消す", async () => {
    const fixture = await createFixture()
    await grantRoot(fixture, targetAccountId)

    const result = await createPending(fixture, {
      actorAccountId: operatorAccountId,
      requesterHasSystemAdmin: false,
      email: "takeover@example.com",
    })

    expect(result).toBe("root_forbidden")
    expect(await countWrites(fixture)).toEqual({
      identities: 0,
      challenges: 0,
      audits: 0,
      tokenVersion: 0,
    })
  })

  test("rootの対象でも、system:adminの操作者と本人は追加できる", async () => {
    const fixture = await createFixture()
    await grantRoot(fixture, targetAccountId)

    const byAdmin = await createPending(fixture, {
      actorAccountId: operatorAccountId,
      requesterHasSystemAdmin: true,
      email: "admin-added@example.com",
    })
    const bySelf = await createPending(fixture, {
      actorAccountId: targetAccountId,
      requesterHasSystemAdmin: false,
      email: "self-added@example.com",
    })

    expect(byAdmin).toMatchObject({ identityId: expect.any(String) })
    expect(bySelf).toMatchObject({ identityId: expect.any(String) })
    expect(await countWrites(fixture)).toMatchObject({ identities: 2, challenges: 2 })
  })

  test("rootでない対象には、system:adminでない操作者も追加できる", async () => {
    const fixture = await createFixture()

    const result = await createPending(fixture, {
      actorAccountId: operatorAccountId,
      requesterHasSystemAdmin: false,
      email: "member@example.com",
    })

    expect(result).toMatchObject({ identityId: expect.any(String) })
    expect(await countWrites(fixture)).toMatchObject({ identities: 1, challenges: 1 })
  })
})
