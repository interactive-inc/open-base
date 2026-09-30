import { systemDeliverySchema } from "@system/infrastructure/schema/system-delivery"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"

const coreSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")
const deliverySql = readFileSync(new URL("./system-delivery.sql", import.meta.url), "utf8")

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSql)
  database.exec(deliverySql)
  database.exec(
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('c0975461-26d2-43a1-86d2-124bd000d9c9', 'active', 0, 1, 1);`,
  )
  return database
}

describe("System delivery schema", () => {
  test("Drizzle宣言とcanonical DDLのtable・columnを一致させる", () => {
    const database = createDatabase()
    const tables = Object.values(systemDeliverySchema)
      .map((table) => getTableConfig(table))
      .sort((left, right) => left.name.localeCompare(right.name))
    expect(tables.map((table) => table.name)).toEqual([
      "system_dead_letters",
      "system_inbox_messages",
      "system_jobs",
      "system_outbox_messages",
    ])
    for (const table of tables) {
      const columns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
        .sort()
      expect(columns).toEqual(table.columns.map((column) => column.name).sort())
    }
  })

  test("jobのlease・terminal状態とinbox重複をDBでもfail closedにする", () => {
    const database = createDatabase()
    database.exec(
      `INSERT INTO system_jobs
         (id, operation_key, payload_digest, idempotency_key, created_by_account_id,
          status, attempt, max_attempts, available_at, lease_account_id, lease_token_hash,
          lease_expires_at, last_error_code, created_at, updated_at, completed_at)
       VALUES ('job:1', 'record.process', '${"a".repeat(64)}', 'command:1', 'c0975461-26d2-43a1-86d2-124bd000d9c9',
         'queued', 0, 1, 1, NULL, NULL, NULL, NULL, 1, 1, NULL);
       INSERT INTO system_inbox_messages
         (id, source_key, external_message_id, payload_digest, status, received_at,
          processed_at, reason_code)
       VALUES ('inbox:1', 'source:1', 'message:1', '${"b".repeat(64)}',
         'accepted', 1, NULL, NULL);`,
    )
    expect(() =>
      database.exec("UPDATE system_jobs SET handler_key = 'example.record' WHERE id = 'job:1'"),
    ).toThrow("system_delivery_handler_immutable")
    expect(() =>
      database.exec(
        `UPDATE system_jobs SET status = 'succeeded', updated_at = 2, completed_at = 2
         WHERE id = 'job:1'`,
      ),
    ).toThrow()
    expect(() =>
      database.exec(
        `INSERT INTO system_inbox_messages
           (id, source_key, external_message_id, payload_digest, status, received_at,
            processed_at, reason_code)
         VALUES ('inbox:2', 'source:1', 'message:1', '${"b".repeat(64)}',
           'accepted', 2, NULL, NULL)`,
      ),
    ).toThrow()
    database.exec(
      `UPDATE system_jobs
       SET status = 'leased', attempt = 1, lease_account_id = 'c0975461-26d2-43a1-86d2-124bd000d9c9',
           lease_token_hash = '${"c".repeat(64)}', lease_expires_at = 10, updated_at = 2
       WHERE id = 'job:1';
       UPDATE system_jobs
       SET status = 'dead_letter', lease_account_id = NULL, lease_token_hash = NULL,
           lease_expires_at = NULL, last_error_code = 'remote.failed',
           updated_at = 3, completed_at = 3
       WHERE id = 'job:1';
       INSERT INTO system_dead_letters
         (id, source_type, source_id, payload_digest, reason_code, attempt,
          recorded_at, requeued_job_id, requeued_at)
       VALUES ('dead:1', 'job', 'job:1', '${"a".repeat(64)}', 'remote.failed', 1,
         3, NULL, NULL);`,
    )
    expect(() => database.exec("DELETE FROM system_jobs WHERE id = 'job:1'")).toThrow(
      "system_jobs_are_retained",
    )
  })
})
