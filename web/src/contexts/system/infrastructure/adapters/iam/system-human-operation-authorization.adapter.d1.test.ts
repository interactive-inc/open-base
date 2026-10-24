import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { SystemHumanOperationAuthorizationAdapter } from "./system-human-operation-authorization.adapter"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const database = await createLocalD1Database({ schema: "" })
  await execSql(
    database,
    readFileSync(new URL("../../schema/system-core.sql", import.meta.url), "utf8"),
  )
  await execSql(
    database,
    readFileSync(new URL("../../schema/system-integration.sql", import.meta.url), "utf8"),
  )
  await execSql(
    database,
    readFileSync(new URL("../../schema/system-principal.sql", import.meta.url), "utf8"),
  )
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'active', 0, 100, 100);
    INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at)
    VALUES ('308954f7-a233-4860-85cb-026577024347', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'human', 'Operator', 1, 100, 100);
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
    VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'operator', 'custom', 'Operator', 100, 100);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:write'), ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:read');
    INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
    VALUES ('d50d88aa-2e8e-4e9b-8d15-2a1fb3ed6a4c', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', '4e74c1bb-6f90-452e-852b-b723b635cc75', 100);
    CREATE TABLE test_records (id TEXT PRIMARY KEY);`,
  )
  const adapter = new SystemHumanOperationAuthorizationAdapter({ env: { DB: database } })
  const input = {
    accountId: "55823b7f-711d-4dbd-af39-039ee6e1b4ff",
    tokenVersion: 0,
    permissions: ["records:read", "records:write"],
    now: new Date(1000),
  }
  return { database, adapter, input }
}

test("現在の人の権限を合成し、global管理者も同じ保存条件を持つ", async () => {
  const { database, adapter, input } = await fixture()
  for (const admin of [false, true]) {
    if (admin)
      await execSql(
        database,
        "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'system:admin')",
      )
    const proof = await adapter.prepare(input)
    if (proof === "forbidden" || proof instanceof Error)
      throw new Error("authorization failed", { cause: proof })
    expect(proof.principalId).toBe("308954f7-a233-4860-85cb-026577024347")
    await database.batch([
      ...proof.assertions,
      database.prepare("INSERT INTO test_records VALUES (?)").bind(String(admin)),
      ...proof.assertions,
    ])
  }
  expect(
    await database
      .prepare("SELECT count(*) AS count FROM test_records")
      .first<Record<string, unknown>>(),
  ).toEqual({ count: 2 })
})

test("明示権限モードでは技術管理者だけの付与を代用しない", async () => {
  const { database, adapter, input } = await fixture()
  await execSql(
    database,
    "DELETE FROM system_iam_role_permissions; INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'system:admin')",
  )
  expect(await adapter.prepare({ ...input, requireExplicitPermissions: true })).toBe("forbidden")
  await execSql(
    database,
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:read'), ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:write')",
  )
  const explicit = await adapter.prepare({ ...input, requireExplicitPermissions: true })
  if (explicit === "forbidden" || explicit instanceof Error) throw explicit
  await database.batch([...explicit.assertions])
  await execSql(
    database,
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'records:write'",
  )
  expect(await database.batch([...explicit.assertions]).catch((cause) => cause)).toBeInstanceOf(
    Error,
  )
})

test("期限・対象scope・Principalの種別・token版を検査する", async () => {
  for (const mutation of [
    "UPDATE system_role_bindings SET revoked_at = 1000",
    "DELETE FROM system_role_bindings; INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at) VALUES ('83f6f682-d347-44f5-8ab9-56d0627d83f6', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', '4e74c1bb-6f90-452e-852b-b723b635cc75', 'records', 'record:1', 100)",
    "UPDATE system_principals SET kind = 'agent', revision = 2",
    "UPDATE system_accounts SET token_version = 1",
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'records:write'",
  ]) {
    const { database, adapter, input } = await fixture()
    await execSql(database, mutation)
    expect(await adapter.prepare(input)).toBe("forbidden")
  }
  const { database, adapter, input } = await fixture()
  await execSql(database, "UPDATE system_role_bindings SET revoked_at = 1001")
  expect(await adapter.prepare(input)).not.toBe("forbidden")
  expect(await adapter.prepare({ ...input, now: new Date(1001) })).toBe("forbidden")
  expect(await adapter.prepare({ ...input, permissions: [] })).toBe("forbidden")
})

test("検査後の状態・付与元の変化で、保存transaction全体を取り消す", async () => {
  for (const mutation of [
    "UPDATE system_accounts SET status = 'suspended', token_version = 1, updated_at = 1001",
    "UPDATE system_accounts SET token_version = 1, updated_at = 1001",
    "UPDATE system_principals SET revision = 2, updated_at = 1001",
    "UPDATE system_role_bindings SET revoked_at = 1001",
    "DELETE FROM system_iam_role_permissions WHERE permission_key = 'records:write'",
    "UPDATE system_iam_roles SET name = 'Changed', updated_at = 1001",
  ]) {
    const { database, adapter, input } = await fixture()
    const proof = await adapter.prepare(input)
    if (proof === "forbidden" || proof instanceof Error)
      throw new Error("authorization failed", { cause: proof })
    await execSql(database, mutation)
    const result = await database
      .batch([database.prepare("INSERT INTO test_records VALUES ('new')"), ...proof.assertions])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(SystemHumanOperationAuthorizationAdapter.rejected(result)).toBe(true)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM test_records")
        .first<Record<string, unknown>>(),
    ).toEqual({ count: 0 })
  }
})
