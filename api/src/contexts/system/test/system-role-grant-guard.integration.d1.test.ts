import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { prepareSystemRoleGrantGuard } from "@system/interface/operations/prepare-system-role-grant-guard"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { integer, sqliteTable } from "drizzle-orm/sqlite-core"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const effect = sqliteTable("test_grant_effect", {
  id: integer("id").primaryKey(),
  value: integer("value"),
})

test("Account 停止・role 変更・禁止権限の追加後は同じ batch の書込を戻す", async () => {
  const database = await createLocalD1Database({
    schema:
      readFileSync(new URL("../infrastructure/schema/system-core.sql", import.meta.url), "utf8") +
      "\nCREATE TABLE test_grant_effect (id INTEGER PRIMARY KEY, value INTEGER NOT NULL);",
  })
  await execSql(
    database,
    `
    INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at)
      VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, NULL, 1, 1);
    INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
      VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'example:member', 'managed', 'example:facility', 'Example member', 1, 1);
    INSERT INTO test_grant_effect (id, value) VALUES (1, 0);
  `,
  )
  const orm = drizzle(database)
  const write = orm.update(effect).set({ value: 1 }).where(eq(effect.id, 1))
  const guard = (roleId = "a290ac92-bf4b-434b-8443-8b6ceeb1cb85") => {
    const statement = prepareSystemRoleGrantGuard({
      database,
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      roleId,
      resourceType: "example:facility",
      forbiddenPermissionKeys: ["system:admin"],
    })
    if (statement instanceof Error) throw statement
    return statement
  }
  const value = () =>
    database.prepare("SELECT value FROM test_grant_effect WHERE id = 1").first<number>("value")

  await expect(orm.batch([guard("5e0f7c3a-1d2b-4c5d-8e6f-0000000000d1"), write])).rejects.toThrow()
  expect(await value()).toBe(0)

  await database
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'system:admin')",
    )
    .run()
  await expect(orm.batch([guard(), write])).rejects.toThrow()
  expect(await value()).toBe(0)
  await database
    .prepare(
      "DELETE FROM system_iam_role_permissions WHERE role_id = 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85'",
    )
    .run()

  await database
    .prepare(
      "UPDATE system_accounts SET status = 'suspended', token_version = 1, updated_at = 2 WHERE id = 'd5858208-e680-4db8-a05d-8bf4f900c24e'",
    )
    .run()
  await expect(orm.batch([guard(), write])).rejects.toThrow()
  expect(await value()).toBe(0)

  await database
    .prepare(
      "UPDATE system_accounts SET status = 'active', token_version = 2, updated_at = 3 WHERE id = 'd5858208-e680-4db8-a05d-8bf4f900c24e'",
    )
    .run()
  await orm.batch([guard(), write])
  expect(await value()).toBe(1)
})
