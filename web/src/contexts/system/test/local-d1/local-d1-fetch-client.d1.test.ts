import { afterAll, beforeAll, expect, setDefaultTimeout, test } from "bun:test"
import { runningWorkerdPids } from "@system/test/local-d1/guard-workerd-stdio.test-support"
import { type LocalD1, startLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

let local: LocalD1

// ローカルD1のworkerd起動を含むため、既定の5秒では足りないことがある。
setDefaultTimeout(30_000)

beforeAll(async () => {
  local = await startLocalD1({ empty: ["in-flight"] })
})

afterAll(async () => {
  await local.dispose()
})

test("処理中の要求はworkerdが落ちると待ち続けずに失敗する", async () => {
  const database = await local.database("in-flight")
  expect(await database.prepare("SELECT 1 AS one").first<number>("one")).toBe(1)
  const pid = runningWorkerdPids().at(-1)
  if (pid === undefined) throw new Error("workerd is not running")

  // 数秒かかる問い合わせを送り、応答の前にworkerdを止める。
  const pending = database
    .prepare(
      "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 50000000) SELECT count(*) AS c FROM n",
    )
    .first<number>("c")
    .then(
      () => null,
      (error: unknown) => error,
    )
  await new Promise((resolve) => setTimeout(resolve, 200))
  process.kill(pid, "SIGKILL")

  const failure = await pending

  expect(failure).toBeInstanceOf(Error)
  expect(failure instanceof Error ? failure.message : "").toContain(
    "local D1 request could not reach workerd",
  )
})
