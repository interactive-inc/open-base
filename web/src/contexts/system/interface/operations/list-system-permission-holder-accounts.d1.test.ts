import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { listSystemPermissionHolderAccounts } from "@system/interface/operations/list-system-permission-holder-accounts"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { testDerivedId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const GLOBAL_HOLDER = "00000000-0000-4000-8000-000000000001"
const SCOPED_HOLDER = "00000000-0000-4000-8000-000000000002"
const OTHER_SCOPE_HOLDER = "00000000-0000-4000-8000-000000000003"
const SUSPENDED_HOLDER = "00000000-0000-4000-8000-000000000004"
const REVOKED_HOLDER = "00000000-0000-4000-8000-000000000005"
const UNRELATED = "00000000-0000-4000-8000-000000000006"
const HOLDER_ROLE = testDerivedId("role", "holder")
const UNRELATED_ROLE = testDerivedId("role", "unrelated")

async function seed() {
  const { context, database } = await SystemSessionTestContext.create()
  const insertAccount = database.prepare(
    "INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES (?1, ?2, 1, 1)",
  )
  await insertAccount.bind(GLOBAL_HOLDER, "active").run()
  await insertAccount.bind(SCOPED_HOLDER, "active").run()
  await insertAccount.bind(OTHER_SCOPE_HOLDER, "active").run()
  await insertAccount.bind(SUSPENDED_HOLDER, "suspended").run()
  await insertAccount.bind(REVOKED_HOLDER, "active").run()
  await insertAccount.bind(UNRELATED, "active").run()
  const insertRole = database.prepare(
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?1, ?2, 'custom', ?2, 1, 1)",
  )
  await insertRole.bind(HOLDER_ROLE, "holder-role").run()
  await insertRole.bind(UNRELATED_ROLE, "unrelated-role").run()
  await database
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, 'example:use'), (?2, 'example:read')",
    )
    .bind(HOLDER_ROLE, UNRELATED_ROLE)
    .run()
  const bind = database.prepare(
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)`,
  )
  const bindingId = (name: string) => testDerivedId("role-binding", name)
  await bind.bind(bindingId("b1"), GLOBAL_HOLDER, HOLDER_ROLE, null, null, null).run()
  await bind.bind(bindingId("b2"), SCOPED_HOLDER, HOLDER_ROLE, "example:resource", "r1", null).run()
  await bind
    .bind(bindingId("b3"), OTHER_SCOPE_HOLDER, HOLDER_ROLE, "example:resource", "r2", null)
    .run()
  await bind.bind(bindingId("b4"), SUSPENDED_HOLDER, HOLDER_ROLE, null, null, null).run()
  await bind.bind(bindingId("b5"), REVOKED_HOLDER, HOLDER_ROLE, null, null, 2).run()
  await bind.bind(bindingId("b6"), UNRELATED, UNRELATED_ROLE, null, null, null).run()
  return context.env.DB
}

describe("listSystemPermissionHolderAccounts", () => {
  test("global割当と指定resourceへの割当を持つactive Accountだけを返す", async () => {
    const database = await seed()
    expect<unknown>(
      await listSystemPermissionHolderAccounts({
        database,
        permissionKey: "example:use",
        resource: { type: "example:resource", id: "r1" },
      }),
    ).toEqual([GLOBAL_HOLDER, SCOPED_HOLDER])
  })

  test("resourceを渡さないときはglobal割当だけを返す", async () => {
    const database = await seed()
    expect<unknown>(
      await listSystemPermissionHolderAccounts({
        database,
        permissionKey: "example:use",
        resource: null,
      }),
    ).toEqual([GLOBAL_HOLDER])
  })

  test("不正なpermissionとresourceを拒否する", async () => {
    const database = await seed()
    expect(
      await listSystemPermissionHolderAccounts({ database, permissionKey: "x", resource: null }),
    ).toBeInstanceOf(Error)
    expect(
      await listSystemPermissionHolderAccounts({
        database,
        permissionKey: "example:use",
        resource: { type: "Invalid", id: "r1" },
      }),
    ).toBeInstanceOf(Error)
  })
})
