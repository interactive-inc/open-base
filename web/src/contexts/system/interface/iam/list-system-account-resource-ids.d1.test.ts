import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { listSystemAccountResourceIds } from "@system/interface/iam/list-system-account-resource-ids"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("Systemの有効な指定resource bindingだけを返す", async () => {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, 0, 0)",
  )
  await execSql(
    fixture.database,
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'role-1', 'managed', 'Role', 0, 0)",
  )
  for (const [id, resourceType, resourceId, revokedAt] of [
    ["5e0f7c3a-1d2b-4c5d-8e6f-0000000000b1", "demo:resource", "resource-1", null],
    ["5e0f7c3a-1d2b-4c5d-8e6f-0000000000b2", "demo:other", "other-1", null],
    ["5e0f7c3a-1d2b-4c5d-8e6f-0000000000b3", "demo:resource", "resource-2", 1],
  ] as const) {
    await fixture.database
      .prepare(
        "INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at) VALUES (?1, 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', ?2, ?3, 0, ?4)",
      )
      .bind(id, resourceType, resourceId, revokedAt)
      .run()
  }

  expect(
    await listSystemAccountResourceIds({
      database: fixture.context.env.DB,
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      resourceType: "demo:resource",
    }),
  ).toEqual(["resource-1"])
  expect(
    await listSystemAccountResourceIds({
      database: fixture.context.env.DB,
      accountId: "d5858208-e680-4db8-a05d-8bf4f900c24e",
      resourceType: "invalid",
    }),
  ).toBeInstanceOf(Error)
})
