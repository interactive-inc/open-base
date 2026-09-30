import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { listSystemPermissionHolderAccounts } from "@system/interface/operations/list-system-permission-holder-accounts"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const GLOBAL_HOLDER = "00000000-0000-4000-8000-000000000001"
const SCOPED_HOLDER = "00000000-0000-4000-8000-000000000002"
const OTHER_SCOPE_HOLDER = "00000000-0000-4000-8000-000000000003"
const SUSPENDED_HOLDER = "00000000-0000-4000-8000-000000000004"
const REVOKED_HOLDER = "00000000-0000-4000-8000-000000000005"
const UNRELATED = "00000000-0000-4000-8000-000000000006"

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
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?1, ?1, 'custom', ?1, 1, 1)",
  )
  await insertRole.bind("holder-role").run()
  await insertRole.bind("unrelated-role").run()
  await execSql(
    database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('holder-role', 'example:use'), ('unrelated-role', 'example:read')",
  )
  const bind = database.prepare(
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)`,
  )
  await bind.bind("b1", GLOBAL_HOLDER, "holder-role", null, null, null).run()
  await bind.bind("b2", SCOPED_HOLDER, "holder-role", "example:resource", "r1", null).run()
  await bind.bind("b3", OTHER_SCOPE_HOLDER, "holder-role", "example:resource", "r2", null).run()
  await bind.bind("b4", SUSPENDED_HOLDER, "holder-role", null, null, null).run()
  await bind.bind("b5", REVOKED_HOLDER, "holder-role", null, null, 2).run()
  await bind.bind("b6", UNRELATED, "unrelated-role", null, null, null).run()
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
