import { prepareSystemPasswordAccountRegistration } from "@system/interface/operations/prepare-system-password-account-registration"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const firstAccount = testAccountId("usr_first")
const secondAccount = testAccountId("usr_second")

test("招待登録のSystem行を同じbatchで作り、Identity競合時はAccountも残さない", async () => {
  const fixture = await SystemSessionTestContext.create()
  const database = fixture.context.env.DB
  const prepare = (accountId: string, identityId: string, email: string) =>
    prepareSystemPasswordAccountRegistration(database, {
      accountId,
      reuseExistingAccount: false,
      identityId,
      email,
      passwordHash: "hashed-password",
      roleBindingId: crypto.randomUUID(),
      roleId: "a290ac92-bf4b-434b-8443-8b6ceeb1cb85",
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

  await expect(
    run(secondAccount, testDerivedId("identity", 2), "person@example.com"),
  ).rejects.toThrow()
  expect(
    await database
      .prepare(`SELECT id FROM system_accounts WHERE id = '${secondAccount}'`)
      .first<{ id: string }>(),
  ).toBeNull()
})
