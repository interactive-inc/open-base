import { existsSync, mkdtempSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"
import { createMockState } from "./seed.ts"
import type { MockState, Scenario } from "./types.ts"

type DatabasePort = {
  exec: (sql: string) => unknown
  prepare: (sql: string) => { get: () => unknown; run: (value: string) => unknown }
  close: () => void
}

/** 一時ディレクトリー内だけに、架空のmock状態を保存する。D1の代替にはしない。 */
export async function createSqliteMock(options: { directory?: string; scenario?: Scenario } = {}) {
  const temporaryRoot = realpathSync(tmpdir())
  const directory = realpathSync(
    options.directory ?? mkdtempSync(join(temporaryRoot, "base-mock-")),
  )
  const roots = [temporaryRoot, ...(existsSync("/tmp") ? [realpathSync("/tmp")] : [])]
  if (!roots.some((root) => directory.startsWith(`${root}${sep}`)))
    throw new Error("mock SQLite は一時ディレクトリー内だけで使えます")
  const path = join(directory, "mock.sqlite")
  const db = (process.versions.bun
    ? new (await import("bun:sqlite")).Database(path)
    : new (await import("node:sqlite")).DatabaseSync(path)) as unknown as DatabasePort
  db.exec(
    "CREATE TABLE IF NOT EXISTS mock_state (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)",
  )
  const query = db.prepare("SELECT value FROM mock_state WHERE id = 1")
  const previous = query.get() as { value: string } | undefined
  const state: MockState = previous ? JSON.parse(previous.value) : createMockState(options.scenario)
  const save = () =>
    db
      .prepare(
        "INSERT INTO mock_state (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify(state))
  save()
  return { state, path, save, close: () => db.close() }
}
