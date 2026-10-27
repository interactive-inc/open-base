import { systemIntegrationSchema } from "@system/infrastructure/schema/system-integration"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig, SQLiteSyncDialect } from "drizzle-orm/sqlite-core"

const CONNECTOR_ID = "6f1c2a0e-5b7d-4c3a-9e21-8a4d0b6c7e15"
const EXCHANGE_ID = "b2d4f6a8-1c3e-4a5b-8c7d-9e0f1a2b3c4d"
const ASSERTION_ID = "3e5a7c9b-2d4f-4b6a-a8c0-1e3f5a7b9c2d"
const RUN_ID = "c7e9a1b3-4d6f-4e8a-b0c2-3d5f7a9b1c4e"
const ITEM_ID = "9a1b3c5d-6e8f-4a0b-92c4-5d7e9f1a3b6c"
const digestA = "a".repeat(64)
const digestB = "b".repeat(64)

const schemaSql = readFileSync(new URL("./system-integration.sql", import.meta.url), "utf8")

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(schemaSql)
  return database
}

describe("System integration schema", () => {
  test("Drizzle宣言とcanonical DDLのtable・columnを一致させる", () => {
    const database = createDatabase()
    const tables = Object.values(systemIntegrationSchema)
      .map((table) => getTableConfig(table))
      .sort((left, right) => left.name.localeCompare(right.name))

    expect(tables.map((table) => table.name)).toEqual([
      "system_connectors",
      "system_external_assertions",
      "system_integration_exchanges",
      "system_reconciliation_items",
      "system_reconciliation_runs",
    ])
    for (const table of tables) {
      const columns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
        .sort()
      expect(columns).toEqual(table.columns.map((column) => column.name).sort())
    }
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
  })

  test("assertionと照合結果をappend-onlyに保つ", () => {
    const database = createDatabase()
    insertRows(database, {
      connector: CONNECTOR_ID,
      exchange: EXCHANGE_ID,
      assertion: ASSERTION_ID,
      run: RUN_ID,
      item: ITEM_ID,
    })

    expect(() =>
      database.exec("UPDATE system_external_assertions SET external_version = '2'"),
    ).toThrow("system_external_assertions_are_immutable")
    expect(() =>
      database.exec("UPDATE system_reconciliation_runs SET local_version = '8'"),
    ).toThrow("system_reconciliation_runs_are_immutable")
    expect(() =>
      database.exec("UPDATE system_reconciliation_items SET item_key = 'record:2'"),
    ).toThrow("system_reconciliation_items_are_immutable")
    expect(() =>
      database.exec(
        "UPDATE system_reconciliation_items SET id = '0d9e8f7a-6b5c-4d3e-8f2a-1b0c9d8e7f6a'",
      ),
    ).toThrow(/system_reconciliation_items_are_immutable|record_identity_immutable/)
    expect(database.query("SELECT id FROM system_reconciliation_items").all()).toEqual([
      { id: ITEM_ID },
    ])
  })

  for (const [target, table] of [
    ["connector", "system_connectors"],
    ["exchange", "system_integration_exchanges"],
    ["assertion", "system_external_assertions"],
    ["run", "system_reconciliation_runs"],
    ["item", "system_reconciliation_items"],
  ] as const) {
    test(`${target}の主キーはUUIDだけを保存する`, () => {
      const valid = {
        connector: CONNECTOR_ID,
        exchange: EXCHANGE_ID,
        assertion: ASSERTION_ID,
        run: RUN_ID,
        item: ITEM_ID,
      }
      for (const invalid of [
        `${target}:1`,
        valid[target].toUpperCase(),
        "00000000-0000-0000-0000-000000000000",
        "ffffffff-ffff-ffff-ffff-ffffffffffff",
      ]) {
        const database = createDatabase()
        expect(() => insertRows(database, { ...valid, [target]: invalid })).toThrow(
          "CHECK constraint failed",
        )
        database.close()
      }

      const database = createDatabase()
      insertRows(database, valid)
      expect(database.query(`SELECT id FROM ${table}`).all()).toEqual([{ id: valid[target] }])
      database.close()
    })
  }

  test("Drizzle宣言とcanonical DDLの主キーのUUID制約を一致させる", () => {
    const database = createDatabase()
    const dialect = new SQLiteSyncDialect()

    for (const table of Object.values(systemIntegrationSchema).map((value) =>
      getTableConfig(value),
    )) {
      const declared = table.checks.find((check) => check.name === `${table.name}_id_uuid`)
      const ddl = database
        .query<{ sql: string }, [string]>(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .get(table.name)

      expect(declared).toBeDefined()
      if (declared === undefined) continue
      expect(ddl?.sql).toContain(`CHECK (${dialect.sqlToQuery(declared.value).sql})`)
    }
  })
})

function insertRows(
  database: Database,
  ids: Readonly<{
    connector: string
    exchange: string
    assertion: string
    run: string
    item: string
  }>,
): void {
  database
    .query(
      `INSERT INTO system_connectors
         (id, key, name, direction, transport, status, revision, created_at, updated_at)
       VALUES (?1, 'generic', 'Generic', 'bidirectional', 'api', 'active', 1, 1, 1)`,
    )
    .run(ids.connector)
  database
    .query(
      `INSERT INTO system_integration_exchanges
         (id, connector_id, direction, operation_key, idempotency_key, payload_digest,
          status, attempt, created_at, updated_at)
       VALUES (?1, ?2, 'outbound', 'record.export', 'command:1', ?3, 'pending', 1, 1, 1)`,
    )
    .run(ids.exchange, ids.connector, digestA)
  database
    .query(
      `INSERT INTO system_external_assertions
         (id, connector_id, exchange_id, external_key, external_version, payload_digest,
          observed_at, received_at)
       VALUES (?1, ?2, ?3, 'record:1', '1', ?4, 2, 2)`,
    )
    .run(ids.assertion, ids.connector, ids.exchange, digestB)
  database
    .query(
      `INSERT INTO system_reconciliation_runs
         (id, exchange_id, assertion_id, local_version, status, created_at)
       VALUES (?1, ?2, ?3, '7', 'mismatched', 3)`,
    )
    .run(ids.run, ids.exchange, ids.assertion)
  database
    .query(
      `INSERT INTO system_reconciliation_items
         (id, run_id, item_key, local_digest, external_digest, status)
       VALUES (?1, ?2, 'record:1', ?3, ?4, 'different')`,
    )
    .run(ids.item, ids.run, digestA, digestB)
}
