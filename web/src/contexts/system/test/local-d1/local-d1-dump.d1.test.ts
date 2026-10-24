import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { exportLocalD1, importLocalD1 } from "@system/test/local-d1/local-d1-dump.test-support"
import { type LocalD1, startLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

let local: LocalD1

// プロセスで最初のファイルは全migrationのtemplateを作るため、数秒以上かかる。
setDefaultTimeout(60_000)

beforeAll(async () => {
  local = await startLocalD1({ migrated: ["source"], empty: ["copy"] })
})

afterAll(async () => {
  await local.dispose()
})

test("書き出したschemaと行を別のDBへ読み込み、triggerと外部キーも同じに戻す", async () => {
  const source = await local.database("source")
  // 製品ごとのmigrationに依存しないよう、検証用のtable・trigger・外部キーをここで作る。
  await execSql(
    source,
    `CREATE TABLE dump_probe_rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE dump_probe_reservations (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES dump_probe_rooms (id)
    );
    CREATE TRIGGER dump_probe_rooms_immutable BEFORE UPDATE ON dump_probe_rooms
    BEGIN
      SELECT RAISE(ABORT, 'dump probe room is immutable');
    END;
    INSERT INTO dump_probe_rooms (id, name) VALUES ('room-1', 'Conference A');
    INSERT INTO dump_probe_reservations (id, room_id) VALUES ('reservation-1', 'room-1');`,
  )
  const dump = await exportLocalD1(source)
  // JSONを経由しても同じ内容を読み込める。
  const copy = await local.database("copy")
  await importLocalD1(copy, JSON.parse(JSON.stringify(dump)))

  const objects = (database: D1Database) =>
    database
      .prepare(
        "SELECT type, name FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name",
      )
      .all()
  expect((await objects(copy)).results).toEqual((await objects(source)).results)
  for (const table of [
    "dump_probe_rooms",
    "dump_probe_reservations",
    "system_iam_roles",
    "system_iam_role_permissions",
  ])
    expect((await copy.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()).results).toEqual(
      (await source.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()).results,
    )
  // 読み込んだ後も外部キーと検査は元のschemaのとおりに働く。
  const rejected = await copy
    .prepare(
      "INSERT INTO dump_probe_reservations (id, room_id) VALUES ('reservation-2', 'missing')",
    )
    .run()
    .then(
      () => null,
      (error: unknown) => error,
    )
  expect(rejected).toBeInstanceOf(Error)
  await expect(
    copy.prepare("UPDATE dump_probe_rooms SET name = 'Changed' WHERE id = 'room-1'").run(),
  ).rejects.toThrow("dump probe room is immutable")
})
