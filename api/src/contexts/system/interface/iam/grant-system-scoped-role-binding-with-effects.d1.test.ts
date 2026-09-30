import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { grantSystemScopedRoleBindingWithEffects } from "@system/interface/iam/grant-system-scoped-role-binding-with-effects"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const actorAccount = testAccountId("actor")
const targetAccount = testAccountId("target")

const now = new Date("2026-01-02T00:00:00.000Z")

async function fixture() {
  const test = await SystemSessionTestContext.create()
  for (const id of [actorAccount, targetAccount]) {
    await test.database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 0, 0)",
      )
      .bind(id)
      .run()
  }
  await execSql(
    test.database,
    "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:manager', 'managed', 'Manager', 0, 0)",
  )
  await execSql(
    test.database,
    "INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at) VALUES ('0bca4bb5-bf10-40ca-8a09-903b1efa21e3', 'demo:worker', 'managed', 'demo:resource', 'Worker', 0, 0)",
  )
  await execSql(
    test.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:manage'), ('0bca4bb5-bf10-40ca-8a09-903b1efa21e3', 'demo:read'), ('848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 'demo:read')",
  )
  await execSql(
    test.database,
    `INSERT INTO system_role_bindings (id, account_id, role_id, created_at) VALUES ('36328491-0ba8-4a11-8b8d-26aff298e39b', '${actorAccount}', '848c3ab1-d54e-4ef8-82ff-dbc3e9f23620', 0)`,
  )
  return test
}

function grant(test: SystemSessionTestContext, actorAccountId = actorAccount) {
  return grantSystemScopedRoleBindingWithEffects({
    database: test.context.env.DB,
    actorAccountId,
    targetAccountId: targetAccount,
    bindingId: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f",
    roleId: "0bca4bb5-bf10-40ca-8a09-903b1efa21e3",
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    forbiddenPermissionKey: "system:admin",
    now,
    effects: [
      test.context.env.DB.prepare(
        `UPDATE system_accounts SET updated_at = ?1 WHERE id = '${actorAccount}'`,
      ).bind(now.getTime()),
    ],
  })
}

test("role付与・外部effect・Account版・監査を同じbatchで保存する", async () => {
  const test = await fixture()
  expect(await grant(test)).toEqual({
    bindingId: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f",
    created: true,
  })
  expect(
    await test.database
      .prepare(`SELECT updated_at FROM system_accounts WHERE id='${actorAccount}'`)
      .first<Record<string, unknown>>(),
  ).toEqual({ updated_at: now.getTime() })
  expect(
    await test.database
      .prepare(
        "SELECT role_id, revoked_at FROM system_role_bindings WHERE id='c9b573fc-3b92-41cb-8bae-4d53a633cf4f'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ role_id: "0bca4bb5-bf10-40ca-8a09-903b1efa21e3", revoked_at: null })
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

test("既存の同一roleならeffectのみ確定しAccount版を進めない", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('0f19bbdb-7229-4e11-8ec3-d8ebfa90844e', '${targetAccount}', '0bca4bb5-bf10-40ca-8a09-903b1efa21e3', 'demo:resource', 'resource-1', 0)`,
  )
  expect(await grant(test)).toEqual({
    bindingId: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e",
    created: false,
  })
  expect(
    await test.database
      .prepare(`SELECT updated_at FROM system_accounts WHERE id='${actorAccount}'`)
      .first<Record<string, unknown>>(),
  ).toEqual({ updated_at: now.getTime() })
  expect(
    await test.database
      .prepare(`SELECT token_version FROM system_accounts WHERE id='${targetAccount}'`)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 0 })
})

test("actorが失効したら外部effectも付与も拒否する", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    "UPDATE system_role_bindings SET revoked_at = 1 WHERE id='36328491-0ba8-4a11-8b8d-26aff298e39b'",
  )
  expect(await grant(test)).toBe("forbidden")
  expect(
    await test.database
      .prepare(`SELECT updated_at FROM system_accounts WHERE id='${actorAccount}'`)
      .first<Record<string, unknown>>(),
  ).toEqual({ updated_at: 0 })
  expect(
    await test.database
      .prepare(
        `SELECT count(*) AS count FROM system_role_bindings WHERE account_id='${targetAccount}'`,
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 0 })
})
