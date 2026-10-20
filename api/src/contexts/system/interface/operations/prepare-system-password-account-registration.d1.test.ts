import { prepareSystemPasswordAccountRegistration } from "@system/interface/operations/prepare-system-password-account-registration"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const firstAccount = testAccountId("usr_first")
const secondAccount = testAccountId("usr_second")
const roleId = "a290ac92-bf4b-434b-8443-8b6ceeb1cb85"

/** role bindingの参照先になるロールを先に作る。 */
async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(
      "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES (?1, 'demo:member', 'managed', 'demo:scope', 'Member', 50, 50)",
    )
    .bind(roleId)
    .run()
  return fixture
}

test("招待登録のSystem行を同じbatchで作り、Identity競合時はAccountも残さない", async () => {
  const fixture = await createFixture()
  const database = fixture.context.env.DB
  const prepare = (accountId: string, identityId: string, email: string) =>
    prepareSystemPasswordAccountRegistration(database, {
      accountId,
      reuseExistingAccount: false,
      identityId,
      email,
      passwordHash: "hashed-password-placeholder",
      roleBindingId: crypto.randomUUID(),
      roleId,
      resourceType: "demo:scope",
      resourceId: "resource-1",
      now: new Date(100),
    })
  const run = async (accountId: string, identityId: string, email: string) => {
    const registration = prepare(accountId, identityId, email)
    if (registration instanceof Error || registration.accountCreation === null) {
      throw new Error("Invalid registration fixture")
    }
    await drizzle(database).batch([
      registration.accountCreation,
      registration.principalCreation,
      registration.identityCreation,
      registration.identityProfileCreation,
      registration.passwordCredentialCreation,
      registration.roleBindingCreation,
    ])
  }

  await run(firstAccount, testDerivedId("identity", 1), "person@example.com")
  expect(
    await database
      .prepare(
        `SELECT resource_type, resource_id FROM system_role_bindings WHERE account_id = '${firstAccount}'`,
      )
      .first<{ resource_type: string; resource_id: string }>(),
  ).toEqual({ resource_type: "demo:scope", resource_id: "resource-1" })
  expect(
    await database
      .prepare(`SELECT kind FROM system_principals WHERE account_id = '${firstAccount}'`)
      .all<{ kind: string }>(),
  ).toMatchObject({ results: [{ kind: "human" }] })

  await expect(
    run(secondAccount, testDerivedId("identity", 2), "person@example.com"),
  ).rejects.toThrow()
  expect(
    await database
      .prepare(`SELECT id FROM system_accounts WHERE id = '${secondAccount}'`)
      .first<{ id: string }>(),
  ).toBeNull()
})

test("既存 Account を再利用する登録は、既にある Principal を上書きしない", async () => {
  const fixture = await createFixture()
  const database = fixture.context.env.DB
  const accountId = testAccountId("usr_reused")
  await database
    .prepare(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 50, 50)",
    )
    .bind(accountId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at) VALUES (?1, ?2, 'agent', 'existing', NULL, 1, 50, 50)",
    )
    .bind(crypto.randomUUID(), accountId)
    .run()
  const registration = prepareSystemPasswordAccountRegistration(database, {
    accountId,
    reuseExistingAccount: true,
    identityId: testDerivedId("identity", 3),
    email: "reused@example.com",
    passwordHash: "hashed-password-placeholder",
    roleBindingId: crypto.randomUUID(),
    roleId,
    resourceType: null,
    resourceId: null,
    now: new Date(100),
  })
  if (registration instanceof Error) throw registration

  await drizzle(database).batch([registration.principalCreation, registration.identityCreation])

  expect(
    await database
      .prepare("SELECT kind, name FROM system_principals WHERE account_id = ?1")
      .bind(accountId)
      .all<{ kind: string; name: string }>(),
  ).toMatchObject({ results: [{ kind: "agent", name: "existing" }] })
})
