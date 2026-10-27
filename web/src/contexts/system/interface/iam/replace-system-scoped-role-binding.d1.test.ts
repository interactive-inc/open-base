import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { replaceSystemScopedRoleBinding } from "@system/interface/iam/replace-system-scoped-role-binding"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const actorAccount = testAccountId("actor")
const targetAccount = testAccountId("target")
const otherAccount = testAccountId("other")

const now = new Date("2026-01-02T00:00:00.000Z")

async function fixture(targetRoleId = "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620") {
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
    `INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('0f19bbdb-7229-4e11-8ec3-d8ebfa90844e', '${targetAccount}', '${targetRoleId}', 'demo:resource', 'resource-1', 0)`,
  )
  return test
}

function replace(
  test: SystemSessionTestContext,
  roleId = "848c3ab1-d54e-4ef8-82ff-dbc3e9f23620",
  change: Readonly<{ bindingId: string; now: Date }> = {
    bindingId: "c9b573fc-3b92-41cb-8bae-4d53a633cf4f",
    now,
  },
) {
  return replaceSystemScopedRoleBinding({
    database: test.context.env.DB,
    actorAccountId: actorAccount,
    targetAccountId: targetAccount,
    bindingId: change.bindingId,
    roleId,
    resourceType: "demo:resource",
    resourceId: "resource-1",
    requiredPermissionKey: "demo:manage",
    managerPermissionKey: "demo:manage",
    now: change.now,
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
        "SELECT before_json, after_json FROM system_audit_events WHERE target_id='c9b573fc-3b92-41cb-8bae-4d53a633cf4f'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({
    before_json:
      '[{"binding_id":"0f19bbdb-7229-4e11-8ec3-d8ebfa90844e","role_id":"848c3ab1-d54e-4ef8-82ff-dbc3e9f23620"}]',
    after_json: `{"account_id":"${targetAccount}","resource":{"id":"resource-1","type":"demo:resource"},"role_id":"848c3ab1-d54e-4ef8-82ff-dbc3e9f23620"}`,
  })
})

test("旧集合を読んだ後に先行する置換が保存されたら、監査・失効・版更新を競合として拒否する", async () => {
  const test = await fixture("0bca4bb5-bf10-40ca-8a09-903b1efa21e3")
  const firstRoleId = "80146241-8715-4df1-a841-6cbd874751a5"
  const secondRoleId = "5d239f9a-49c6-444b-93f4-14eeb0f1471c"
  for (const roleId of [firstRoleId, secondRoleId]) {
    await test.database
      .prepare(
        `INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
         VALUES (?1, ?2, 'custom', 'demo:resource', ?2, 0, 0)`,
      )
      .bind(roleId, `demo:${roleId}`)
      .run()
    await test.database
      .prepare(
        "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, 'demo:read')",
      )
      .bind(roleId)
      .run()
  }
  await execSql(
    test.database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('f8dc2e88-fc2d-4a67-8c0e-11db39f67d75', 'demo:read')",
  )

  const earlier = new Date(now.getTime() - 1000)
  const firstBindingId = "595d12a0-08bc-4467-bc72-6f580d44c020"
  const batch = test.database.batch.bind(test.database)
  const interleaved = spyOn(test.database, "batch").mockImplementationOnce(
    async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
      expect(await replace(test, firstRoleId, { bindingId: firstBindingId, now: earlier })).toBe(
        "replaced",
      )
      return batch<T>(statements)
    },
  )
  try {
    expect(await replace(test, secondRoleId)).toBe("conflict")
    expect(interleaved).toHaveBeenCalledTimes(2)
  } finally {
    interleaved.mockRestore()
  }
  expect(
    (
      await test.database
        .prepare(
          "SELECT id, role_id, revoked_at FROM system_role_bindings WHERE account_id = ?1 ORDER BY created_at",
        )
        .bind(targetAccount)
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([
    {
      id: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e",
      role_id: "0bca4bb5-bf10-40ca-8a09-903b1efa21e3",
      revoked_at: earlier.getTime(),
    },
    { id: firstBindingId, role_id: firstRoleId, revoked_at: null },
  ])
  expect(
    await test.database
      .prepare("SELECT token_version, updated_at FROM system_accounts WHERE id = ?1")
      .bind(targetAccount)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 1, updated_at: earlier.getTime() })
  expect(
    (
      await test.database
        .prepare(
          "SELECT target_id, before_json, after_json FROM system_audit_events WHERE action = 'system.iam.role_binding.replaced' ORDER BY occurred_at",
        )
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([
    {
      target_id: firstBindingId,
      before_json:
        '[{"binding_id":"0f19bbdb-7229-4e11-8ec3-d8ebfa90844e","role_id":"0bca4bb5-bf10-40ca-8a09-903b1efa21e3"}]',
      after_json: `{"account_id":"${targetAccount}","resource":{"id":"resource-1","type":"demo:resource"},"role_id":"${firstRoleId}"}`,
    },
  ])

  expect(await replace(test, secondRoleId)).toBe("replaced")
  expect(
    await test.database
      .prepare(
        "SELECT before_json, after_json FROM system_audit_events WHERE target_id = 'c9b573fc-3b92-41cb-8bae-4d53a633cf4f'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({
    before_json: `[{"binding_id":"${firstBindingId}","role_id":"${firstRoleId}"}]`,
    after_json: `{"account_id":"${targetAccount}","resource":{"id":"resource-1","type":"demo:resource"},"role_id":"${secondRoleId}"}`,
  })
  expect(
    await test.database
      .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
      .bind(targetAccount)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 2 })
})

test("旧集合が空でも、読取後に追加されたbindingを監査なしに失効しない", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    "UPDATE system_role_bindings SET revoked_at = 1 WHERE id = '0f19bbdb-7229-4e11-8ec3-d8ebfa90844e'",
  )
  const firstBindingId = "595d12a0-08bc-4467-bc72-6f580d44c020"
  const batch = test.database.batch.bind(test.database)
  const interleaved = spyOn(test.database, "batch").mockImplementationOnce(
    async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
      expect(
        await replace(test, undefined, {
          bindingId: firstBindingId,
          now: new Date(now.getTime() - 1000),
        }),
      ).toBe("replaced")
      return batch<T>(statements)
    },
  )
  try {
    expect(await replace(test)).toBe("conflict")
  } finally {
    interleaved.mockRestore()
  }
  expect(
    await test.database
      .prepare("SELECT revoked_at FROM system_role_bindings WHERE id = ?1")
      .bind(firstBindingId)
      .first<Record<string, unknown>>(),
  ).toEqual({ revoked_at: null })
  expect(
    await test.database
      .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
      .bind(targetAccount)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 1 })
  expect(
    await test.database
      .prepare(
        "SELECT count(*) AS total FROM system_audit_events WHERE action = 'system.iam.role_binding.replaced'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ total: 1 })
})

test("監査の保存に失敗したら旧binding・新binding・Account版をすべて戻す", async () => {
  const test = await fixture()
  const failure = spyOn(
    SystemAuditEventRepository.prototype,
    "prepareAppend",
  ).mockImplementationOnce(() => [
    test.database.prepare("SELECT * FROM missing_audit_table"),
    test.database.prepare("SELECT 1"),
  ])
  try {
    expect(await replace(test)).toBeInstanceOf(Error)
  } finally {
    failure.mockRestore()
  }
  expect(
    (
      await test.database
        .prepare("SELECT id, revoked_at FROM system_role_bindings WHERE account_id = ?1")
        .bind(targetAccount)
        .all<Record<string, unknown>>()
    ).results,
  ).toEqual([{ id: "0f19bbdb-7229-4e11-8ec3-d8ebfa90844e", revoked_at: null }])
  expect(
    await test.database
      .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
      .bind(targetAccount)
      .first<Record<string, unknown>>(),
  ).toEqual({ token_version: 0 })
  expect(
    await test.database
      .prepare("SELECT count(*) AS total FROM system_audit_events")
      .first<Record<string, unknown>>(),
  ).toEqual({ total: 0 })
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

test("globalのsystem:adminだけを持つ操作者は、resource管理権限を直接持たなくても置換できる", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    "UPDATE system_iam_role_permissions SET permission_key = 'system:admin' WHERE role_id = 'f8dc2e88-fc2d-4a67-8c0e-11db39f67d75'",
  )

  expect(await replace(test)).toBe("replaced")
})

test("resourceに限ったsystem:adminはglobal管理者として扱わない", async () => {
  const test = await fixture()
  await execSql(
    test.database,
    `UPDATE system_role_bindings SET revoked_at = 1 WHERE id = '36328491-0ba8-4a11-8b8d-26aff298e39b';
     INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
     VALUES ('5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d01', 'demo:scoped-admin', 'managed', 'demo:resource', 'Scoped admin', 0, 0);
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
     VALUES ('5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d01', 'system:admin');
     INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at)
     VALUES ('6e7f8091-a2b3-4c4d-9e5f-6a7b8c9d0e12', '${actorAccount}', '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d01', 'demo:resource', 'resource-1', 0);`,
  )

  expect(await replace(test)).toBe("forbidden")
})
