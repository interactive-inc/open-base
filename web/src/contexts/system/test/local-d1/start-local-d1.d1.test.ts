import { expect, setDefaultTimeout, test } from "bun:test"
import {
  runningWorkerdPids,
  workerdExited,
} from "@system/test/local-d1/guard-workerd-stdio.test-support"
import { startLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

// ローカルD1のworkerd起動を含むため、既定の5秒では足りないことがある。
setDefaultTimeout(30_000)

test("共有のworkerdが止められた後のファイルは、新しいworkerdのDBを使う", async () => {
  const first = await startLocalD1({ empty: ["before-kill"] })
  const before = await first.database("before-kill")
  expect(await before.prepare("SELECT 1 AS one").first<number>("one")).toBe(1)
  const pid = runningWorkerdPids().at(-1)
  if (pid === undefined) throw new Error("workerd is not running")

  // bun test がtimeoutしたtestの子プロセスを止めるのと同じく、workerdを止める。
  process.kill(pid, "SIGKILL")
  await workerdExited(pid)
  await first.dispose()

  const second = await startLocalD1({ empty: ["after-kill"] })
  const after = await second.database("after-kill")

  expect(await after.prepare("SELECT 2 AS two").first<number>("two")).toBe(2)
  expect(runningWorkerdPids()).not.toContain(pid)
  await second.dispose()
})

test("snapshotは複製した時点の内容を別のDBとして開き、以降の変更を互いに持ち込まない", async () => {
  const local = await startLocalD1({ migrated: ["snapshot-source", "snapshot-copy", "unopened"] })
  const source = await local.database("snapshot-source")
  await source.exec("CREATE TABLE snapshot_probe (value TEXT NOT NULL)")
  await source.prepare("INSERT INTO snapshot_probe (value) VALUES ('before')").run()

  await expect(local.snapshot("unopened", "snapshot-copy")).rejects.toThrow("has not been opened")
  await local.snapshot("snapshot-source", "snapshot-copy")
  await expect(local.snapshot("snapshot-source", "snapshot-copy")).rejects.toThrow(
    "is already open",
  )
  await source.prepare("INSERT INTO snapshot_probe (value) VALUES ('after')").run()

  const copy = await local.database("snapshot-copy")
  const values = async (database: D1Database) =>
    (await database.prepare("SELECT value FROM snapshot_probe ORDER BY rowid").all()).results
  expect(await values(copy)).toEqual([{ value: "before" }])
  await copy.prepare("INSERT INTO snapshot_probe (value) VALUES ('copy only')").run()
  expect(await values(source)).toEqual([{ value: "before" }, { value: "after" }])
  await local.dispose()
})
