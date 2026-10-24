import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { replaceSystemScopedRoleBinding } from "@system/interface/iam/replace-system-scoped-role-binding"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const actorAccount = testAccountId("actor")
const targetAccount = testAccountId("target")
const otherAccount = testAccountId("other")

const now = new Date("2026-01-02T00:00:00.000Z")

async function fixture() {
  const test = await SystemSessionTestContext.create()
  for (const id of [actorAccount, targetAccount, otherAccount]) {
    await test.database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .bind(id)
      .run()
  }
  for (const [id, permission] of [
    ["f8dc2e88-fc2d-4a67-8c0e-11db39f67d75", "demo:manage"],
    ["848c3ab1-d54e-4ef8-82ff-dbc3e9f23620", "demo:manage"],
    ["0bca4bb5-bf10-40ca-8a09-903b1efa21e3", "demo:read"],
  ]) {
    await test.database
      .prepare(
        "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES (?1, ?2, 'managed', ?3, ?1, 0, 0)",
      )
      .bind(
        id,
        `demo:${id}`,
        id === "f8dc2e88-fc2d-4a67-8c0e-11db39f67d75" ? null : "demo:resource",
      )
      .run()
    await test.database
      .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .bind(id, permission)
      .run()
  }
  await execSql(
    test.database,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('36328491-0ba8-4a11-8b8d-26aff298e39b', '${actorAccount}', 'f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', NULL, NULL, 0)`,
  )
  await execSql(
    test.database,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('0f19bbdb-7229-4e11-8ec3-d8ebfa90844e', '${targetAccount}', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:resource', 'resource-1', 0)`,
  )
  return test
}

function replace(test: SystemSessionTestContext, roleId = "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620") {
  return replaceSystemScopedRoleBinding({
    database: test.context.env.DB,
    actorAccountId: actorAccount,
    targetAccountId: targetAccount,
    bindingId: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f",
    roleId,
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    managerPermissionKey: "demo:manage",
    now,
  })
}

test("置換は旧bindingを履歴として残し、新binding・版・監査を原子的に作る", async () => {
  const test = await fixture()
  expect(await replace(test)).toBe("replaced")
  expect(
    (
      await test.database
        .prepare(
          `SELECT id, revoked_at FROM system_role_bindings WHERE account_id='${targetAccount}' ORDER BY revoked_at IS NOT NULL, id`,
        )
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([
    { id: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f", revoked_at: null },
    { id: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e", revoked_at: now.getTime() },
  ])
  expect(
    await test.database
      .prepare(`SELECT token_version FROM system_accounts WHERE id='${targetAccount}'`)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 1 })
  expect(
    await test.database
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE target_id='c9b573fc-3b92-41cb-8bae-4d53a633cf4f'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 1 })
})

test("最後の管理者を非管理ロールに置換すると全変更をロールバックする", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', 'demo:read')",
  )
  expect(await replace(test, "0bca4bb5-bf10-40ca-8a09-903b1efa21e3")).toBe("last_manager")
  expect(
    (
      await test.database
        .prepare(
          `SELECT id, revoked_at FROM system_role_bindings WHERE account_id='${targetAccount}'`,
        )
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([{ id: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e", revoked_at: null }])
  expect(
    await test.database
      .prepare(`SELECT token_version FROM system_accounts WHERE id='${targetAccount}'`)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 0 })
})

test("actorにない権限を含むroleは置換できない", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'system:admin')",
  )
  expect(await replace(test)).toBe("forbidden")
  expect(
    await test.database
      .prepare(
        `SELECT count(*) AS count FROM system_role_bindings WHERE account_id='${targetAccount}'`,
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 1 })
})
