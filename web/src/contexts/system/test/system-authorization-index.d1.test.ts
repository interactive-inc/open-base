import { afterAll, expect, test } from "bun:test"
import { Miniflare } from "miniflare"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"

const runtime = new Miniflare({
  modules: true,
  script: "export default { fetch() { return new Response(null) } }",
  compatibilityDate: "2026-08-01",
  d1Databases: ["DB"],
})
afterAll(() => runtime.dispose())

const accountId = zAccountId.parse("a7cecc94-7329-4e80-823b-025b441a0c21")
const emptyAccountId = zAccountId.parse("285eb0d4-4786-472e-94cf-c90aab826e20")
const roleId = "ad7c2a56-4864-4d0c-b279-a9e5031921dd"
const bindingId = "9e9b33b0-7299-4457-bd4b-4937f03a1ce7"

test("権限のないAccountも保持し、他Accountの付与件数によらず本人だけを読む", async () => {
  const database = (await runtime.getD1Database("DB")) as unknown as D1Database
  for (const statement of [
    "CREATE TABLE system_accounts (id TEXT PRIMARY KEY, status TEXT NOT NULL)",
    `CREATE TABLE system_iam_roles (
      id TEXT PRIMARY KEY, key TEXT, kind TEXT, resource_type TEXT, name TEXT,
      created_at INTEGER, updated_at INTEGER
    )`,
    `CREATE TABLE system_iam_role_permissions (
      role_id TEXT, permission_key TEXT, PRIMARY KEY (role_id, permission_key)
    )`,
    `CREATE TABLE system_role_bindings (
      id TEXT PRIMARY KEY, account_id TEXT, role_id TEXT, resource_type TEXT,
      resource_id TEXT, created_at INTEGER, revoked_at INTEGER
    )`,
    "CREATE INDEX system_role_bindings_account_idx ON system_role_bindings(account_id, created_at)",
  ]) {
    await database.prepare(statement).run()
  }
  await database.batch([
    database
      .prepare("INSERT INTO system_accounts VALUES (?, 'active'), (?, 'active')")
      .bind(accountId, emptyAccountId),
    database
      .prepare(
        "INSERT INTO system_iam_roles VALUES (?, 'system:reader', 'managed', NULL, 'Reader', 1000, 1000)",
      )
      .bind(roleId),
    database.prepare("INSERT INTO system_iam_role_permissions VALUES (?, 'iam:read')").bind(roleId),
    database
      .prepare("INSERT INTO system_role_bindings VALUES (?, ?, ?, NULL, NULL, 1000, 3000)")
      .bind(bindingId, accountId, roleId),
    database
      .prepare(`WITH RECURSIVE sequence(n) AS (
      SELECT 1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 1000
    ) INSERT INTO system_role_bindings
      SELECT 'other-binding-' || n, 'other-account-' || n, ?, NULL, NULL, 1000, NULL FROM sequence`)
      .bind(roleId),
  ])

  const repository = new SystemD1AuthorizationAdapter({ env: { DB: database } })
  const rows = await repository.statementForAccount(accountId).all()
  expect(rows.results).toHaveLength(1)
  expect(rows.meta.rows_read).toBeLessThan(50)
  const graph = await repository.loadForAccount(accountId)
  if (graph === null || graph instanceof Error) throw new Error("authorization unavailable")
  expect(graph.bindings.map((binding) => String(binding.id))).toEqual([bindingId])
  expect(graph.roles.flatMap((role) => role.permissionKeys)).toEqual(["iam:read"])

  const beforeRevocation = repository.resolveGraph(graph, { resource: null, at: new Date(2000) })
  const afterRevocation = repository.resolveGraph(graph, { resource: null, at: new Date(3000) })
  if (beforeRevocation === null || beforeRevocation instanceof Error)
    throw new Error("authorization unavailable")
  if (afterRevocation === null || afterRevocation instanceof Error)
    throw new Error("authorization unavailable")
  expect([...beforeRevocation.permissionKeys]).toEqual(["iam:read"])
  expect([...afterRevocation.permissionKeys]).toEqual([])

  const empty = await repository.loadForAccount(emptyAccountId)
  expect(empty).toEqual({ roles: [], bindings: [] })
  await database
    .prepare("UPDATE system_accounts SET status='suspended' WHERE id=?")
    .bind(accountId)
    .run()
  expect(await repository.loadForAccount(accountId)).toBeNull()
  await database.prepare("DELETE FROM system_accounts WHERE id=?").bind(accountId).run()
  expect(await repository.loadForAccount(accountId)).toBeNull()
}, 15000)
