import { systemIntegrationSchema } from "@system/infrastructure/schema/system-integration"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"

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
    database.exec(
      `INSERT INTO system_connectors
         (id, key, name, direction, transport, status, revision, created_at, updated_at)
       VALUES ('connector:1', 'generic', 'Generic', 'bidirectional', 'api', 'active', 1, 1, 1);
       INSERT INTO system_integration_exchanges
         (id, connector_id, direction, operation_key, idempotency_key, payload_digest,
          status, attempt, created_at, updated_at)
       VALUES ('exchange:1', 'connector:1', 'outbound', 'record.export', 'command:1',
         '${"a".repeat(64)}', 'pending', 1, 1, 1);
       INSERT INTO system_external_assertions
         (id, connector_id, exchange_id, external_key, external_version, payload_digest,
          observed_at, received_at)
       VALUES ('assertion:1', 'connector:1', 'exchange:1', 'record:1', '1',
         '${"b".repeat(64)}', 2, 2);`,
    )

    expect(() =>
      database.exec("UPDATE system_external_assertions SET external_version = '2'"),
    ).toThrow("system_external_assertions_are_immutable")
  })
})
