import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { expect, test } from "bun:test"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

const directory = new URL("../../../db/migrations/", import.meta.url).pathname
const names = readdirSync(directory)
  .filter((name) => name.endsWith(".sql"))
  .sort()
const firstUpgrade = "0015_account_invitation_issuer.sql"
const prior = names
  .filter((name) => name < firstUpgrade)
  .map((name) => readFileSync(join(directory, name), "utf8"))
  .join("\n")
const lastUpgrade = "0016_office_tenure_periods.sql"
const upgrades = names.filter((name) => name >= firstUpgrade && name <= lastUpgrade)
const guardNames = [
  "company_office_tenure_lifecycle_guard",
  "company_office_tenure_operation_guard",
  "company_office_tenure_revision_guard",
]

/** 実際の移行読込器の区切りを使い、各ファイルを一つのD1 batchで適用する。 */
async function applyMigration(database: D1Database, name: string): Promise<void> {
  const content = readFileSync(join(directory, name), "utf8")
  const hash = createHash("sha256").update(content).digest("hex")
  const migration = readMigrationFiles({ migrationsFolder: directory }).find(
    (entry) => entry.hash === hash,
  )
  if (migration === undefined) throw new Error("migration not found")
  await database.batch(migration.sql.map((statement) => database.prepare(statement)))
}

/** 適用済みの基盤へ追記し、保存済み招待の情報と外部キーを維持する。 */
test("基盤の前進移行は既存招待を維持し、任期の検査を導入する", async () => {
  const database = await createLocalD1Database({ schema: prior })
  const roleId = crypto.randomUUID()
  const invitationId = crypto.randomUUID()
  await database
    .prepare(`INSERT INTO system_iam_roles
    (id, key, kind, name, created_at, updated_at) VALUES (?1, 'upgrade-role', 'custom', 'Upgrade role', 1000, 1000)`)
    .bind(roleId)
    .run()
  await database
    .prepare(`INSERT INTO system_account_invitations
    (id, token, role_id, expires_at, created_at, updated_at) VALUES (?1, ?2, ?3, 2000, 1000, 1000)`)
    .bind(invitationId, "a".repeat(64), roleId)
    .run()
  const before = await database.prepare("SELECT * FROM system_account_invitations").first()
  for (const name of upgrades) await applyMigration(database, name)
  expect(upgrades).toHaveLength(2)
  expect(await database.prepare("SELECT * FROM system_account_invitations").first()).toEqual({
    ...before,
    issued_by_account_id: null,
  })
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  expect(
    (
      await database
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger'
    AND name LIKE 'company_office_tenure_%' ORDER BY name`)
        .all()
    ).results,
  ).toEqual(guardNames.map((name) => ({ name })))
  expect(
    (
      await database
        .prepare(`SELECT name FROM sqlite_master WHERE name IN
    ('company_active_office_holder_uniq', 'company_active_collective_body_member_uniq')`)
        .all()
    ).results,
  ).toEqual([])
  expect(
    (await database.prepare("SELECT * FROM company_office_tenure_overlaps").all()).results,
  ).toEqual([])
}, 120_000)

/** 既存の期間重複は、索引を外す前に検出し、同じ処理内の変更を取り消す。 */
test("既存の任期が重なる場合は旧い索引と行を維持して停止する", async () => {
  const database = await createLocalD1Database({
    schema: `
    CREATE TABLE company_resource_revisions (
      organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER,
      effective_from TEXT, effective_to TEXT, state TEXT, corrects_revision INTEGER, attributes_json TEXT);
    CREATE TABLE company_resource_heads (id TEXT PRIMARY KEY);
    CREATE UNIQUE INDEX company_active_office_holder_uniq ON company_resource_heads(id);
    CREATE UNIQUE INDEX company_active_collective_body_member_uniq ON company_resource_heads(id);
  `,
  })
  for (const id of ["former", "successor"]) {
    await database
      .prepare(`INSERT INTO company_resource_revisions VALUES
      ('organization', 'office-assignment', ?1, 1, '2030-01-01', '2030-03-01', 'active', NULL, ?2)`)
      .bind(id, JSON.stringify({ organizationalOfficeId: "office", employeeId: id }))
      .run()
  }
  const before = (
    await database.prepare("SELECT * FROM company_resource_revisions ORDER BY resource_id").all()
  ).results
  await expect(applyMigration(database, "0016_office_tenure_periods.sql")).rejects.toThrow()
  expect(
    (await database.prepare("SELECT * FROM company_resource_revisions ORDER BY resource_id").all())
      .results,
  ).toEqual(before)
  expect(
    await database
      .prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index'
    AND name IN ('company_active_office_holder_uniq', 'company_active_collective_body_member_uniq')`)
      .first(),
  ).toEqual({ count: 2 })
  expect(
    await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'company_office_tenure_overlaps'",
      )
      .first(),
  ).toEqual({ count: 0 })
}, 120_000)

/** 索引を外した後でガードの導入が失敗しても、移行全体を取り消す。 */
test("ガードを導入できない場合も旧い索引を失わない", async () => {
  const database = await createLocalD1Database({
    schema: `
    CREATE TABLE company_resource_revisions (
      organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER,
      effective_from TEXT, effective_to TEXT, state TEXT, corrects_revision INTEGER, attributes_json TEXT);
    CREATE TABLE company_resource_heads (id TEXT PRIMARY KEY);
    CREATE UNIQUE INDEX company_active_office_holder_uniq ON company_resource_heads(id);
    CREATE UNIQUE INDEX company_active_collective_body_member_uniq ON company_resource_heads(id);
  `,
  })
  // ガードの対象表が無いため、索引削除より後のガード作成で失敗する。
  await expect(applyMigration(database, "0016_office_tenure_periods.sql")).rejects.toThrow()
  expect(
    await database
      .prepare(`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index'
    AND name IN ('company_active_office_holder_uniq', 'company_active_collective_body_member_uniq')`)
      .first(),
  ).toEqual({ count: 2 })
  expect(
    await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'company_office_tenure_overlaps'",
      )
      .first(),
  ).toEqual({ count: 0 })
  expect(
    await database
      .prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'company_office_tenure_%'",
      )
      .first(),
  ).toEqual({ count: 0 })
}, 120_000)
