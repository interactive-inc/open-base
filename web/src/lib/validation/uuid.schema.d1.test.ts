import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { uuidCheckPredicate, uuidSchema } from "@/lib/validation/uuid.schema"
import { type LocalD1, startLocalD1 } from "@system/test/local-d1/start-local-d1.test-support"

/**
 * bun:sqlite と D1 は同じ SQLite ではない。述語が D1 の CHECK として受理され、D1 上で
 * uuidSchema と同じ集合を表すことをローカル D1 (Miniflare) で確かめる。
 * CHECK を含む migration を追加するときの前提になる。
 *
 * 長い GLOB を D1 が拒否することの対照実験はここに置かない。"pattern too complex" を
 * 起こすと同じ process で後続の D1 test の接続が切れるため、GLOB の長さの上限は
 * `uuid.schema.test.ts` で静的に検査する。
 */

const probes: ReadonlyArray<string> = [
  ...Array.from({ length: 20 }, () => crypto.randomUUID()),
  "01900001-0000-7000-8000-000000000001",
  ...Array.from(
    { length: 16 },
    (_, index) => `abcdefab-cdef-${index.toString(16)}abc-8def-abcdefabcdef`,
  ),
  ...Array.from(
    { length: 16 },
    (_, index) => `abcdefab-cdef-4abc-${index.toString(16)}def-abcdefabcdef`,
  ),
  "10000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "4E70A050-497B-482E-9766-6937DCA05295",
  "0190000--0000-7000-8000-000000000a01",
  "01900000-0000-7000-8000-00000000-a01",
  "0195e2a1-4c3f-7abc-8def-0123456789ag",
  "0195e2a1-4c3f-7abc-8def-0123456789abc",
  "organization:default",
  "1",
  "",
]

let local: LocalD1

beforeAll(async () => {
  local = await startLocalD1({ empty: ["uuid-check"] })
})

afterAll(async () => {
  await local.dispose()
})

async function rejectionOf(operation: Promise<unknown>): Promise<string> {
  return operation.then(
    () => "",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  )
}

describe("uuidCheckPredicate on local D1", () => {
  test("D1 が CHECK として受理し、uuidSchema と同じ値だけを保存する", async () => {
    const database = await local.database("uuid-check")
    await database
      .prepare(`CREATE TABLE probe (id TEXT NOT NULL, CHECK (${uuidCheckPredicate("id")}))`)
      .run()

    const disagreements: string[] = []

    for (const value of probes) {
      const failure = await rejectionOf(
        database.prepare("INSERT INTO probe (id) VALUES (?1)").bind(value).run(),
      )
      const stored = failure === ""

      if (stored) await database.prepare("DELETE FROM probe").run()
      if (failure !== "" && !failure.includes("CHECK constraint failed")) {
        disagreements.push(`${value}: ${failure}`)
      }
      if (stored !== uuidSchema.safeParse(value).success) disagreements.push(value)
    }

    expect(disagreements).toEqual([])
  })
})
