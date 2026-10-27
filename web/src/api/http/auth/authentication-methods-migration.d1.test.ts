import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"

const directory = new URL("../../../db/migrations/", import.meta.url).pathname
const migrationName = "0006_authentication_methods.sql"
const prior = readdirSync(directory)
  .filter((name) => name.endsWith(".sql") && name < migrationName)
  .sort()
  .map((name) => readFileSync(join(directory, name), "utf8"))
  .join("\n")
const migration = readFileSync(join(directory, migrationName), "utf8")
const accountId = "105d6c58-b5e3-4f30-8a1b-6f021ce78231"
const identityId = "dbd8dab6-a50c-4fa8-97bc-e2bd71af0729"
const tables = [
  "system_accounts",
  "system_identity_bindings",
  "system_identity_profiles",
  "company_external_identity_sources",
  "system_passkey_enrollments",
]

async function fixture() {
  const database = await createLocalD1Database({ schema: prior })
  await database
    .prepare(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 3, 1000, 1000)",
    )
    .bind(accountId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at) VALUES (?1, ?2, 'passkey', 'you@example.com', 1000, 1000)",
    )
    .bind(identityId, accountId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_identity_profiles (identity_id, email, email_verified, updated_at, can_receive_email) VALUES (?1, 'you@example.com', 1, 1000, 0)",
    )
    .bind(identityId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_passkey_enrollments (id, account_id, identity_id, token_hash, reason, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, 'bootstrap', 1000, 2000)",
    )
    .bind(crypto.randomUUID(), accountId, identityId, "a".repeat(64))
    .run()
  return database
}
async function snapshot(database: D1Database) {
  return Promise.all(
    tables.map(async (table) => ({
      table,
      rows: (await database.prepare(`SELECT * FROM ${table}`).all()).results,
    })),
  )
}
test("認証方式の追加後も保存済みの資格情報と参照を一切変えない", async () => {
  const database = await fixture()
  const before = await snapshot(database)
  await execSql(database, migration)
  expect(await snapshot(database)).toEqual(before)
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  expect(
    (await database.prepare("SELECT name FROM sqlite_master WHERE name LIKE '_auth_stage_%'").all())
      .results,
  ).toEqual([])
}, 120_000)

test("未知の子表がある場合は保存済みの情報を削除する前に止まる", async () => {
  const database = await fixture()
  await execSql(
    database,
    "CREATE TABLE future_identity_child (identity_id TEXT REFERENCES system_identity_bindings(id) ON DELETE CASCADE);",
  )
  await database.prepare("INSERT INTO future_identity_child VALUES (?1)").bind(identityId).run()
  const before = await snapshot(database)
  await expect(execSql(database, migration)).rejects.toThrow()
  expect(await snapshot(database)).toEqual(before)
  expect(
    (await database.prepare("SELECT identity_id FROM future_identity_child").all()).results,
  ).toEqual([{ identity_id: identityId }])
}, 120_000)
