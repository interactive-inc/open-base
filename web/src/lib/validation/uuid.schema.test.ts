import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { uuidCheckPredicate, uuidSchema } from "@/lib/validation/uuid.schema"

/** 版・variant・区切り・文字種・桁の境界を網羅する入力。 */
const uuidProbeValues: ReadonlyArray<string> = [
  "01900000-0000-7000-8000-000000000a01",
  "4e70a050-497b-482e-9766-6937dca05295",
  ...Array.from(
    { length: 16 },
    (_, index) => `abcdefab-cdef-${index.toString(16)}abc-8def-abcdefabcdef`,
  ),
  ...Array.from(
    { length: 16 },
    (_, index) => `abcdefab-cdef-4abc-${index.toString(16)}def-abcdefabcdef`,
  ),
  "11111111-1111-1111-1111-111111111111",
  "00000000-0000-0000-0000-000000000000",
  "ffffffff-ffff-ffff-ffff-ffffffffffff",
  "0195E2A1-4C3F-7ABC-8DEF-0123456789AB",
  "0195e2a1-4c3f-7abc-8def-0123456789a",
  "0195e2a1-4c3f-7abc-8def-0123456789abc",
  "0195e2a1_4c3f_7abc_8def_0123456789ab",
  "0195e2a1-4c3f-7abc-8def-0123456789ag",
  "0190000--0000-7000-8000-000000000a01",
  "01900000-0000-7000-8000-00000000-a01",
  "-1900000-0000-7000-8000-000000000a01",
  "{0190000-0000-7000-8000-000000000a01}",
  "organization:default",
  "1",
  "",
]

/** 同じ入力を bun:sqlite の CHECK に通し、受け入れたかを返す。 */
function sqlAccepts(values: ReadonlyArray<string>): boolean[] {
  const database = new Database(":memory:")
  database.run(`CREATE TABLE probe (id TEXT NOT NULL, CHECK (${uuidCheckPredicate("id")}))`)

  return values.map((value) => {
    try {
      database.run("DELETE FROM probe")
      database.run("INSERT INTO probe (id) VALUES (?)", [value])
      return true
    } catch {
      return false
    }
  })
}

describe("uuidSchema", () => {
  test("RFC 9562 準拠の小文字 UUID を受け入れる", () => {
    expect(uuidSchema.safeParse("01900000-0000-7000-8000-000000000a01").success).toBe(true)
    expect(uuidSchema.safeParse(crypto.randomUUID()).success).toBe(true)
  })

  test("連番・独自形式・大文字・nil・max・version 0 を拒否する", () => {
    for (const value of [
      "1",
      "organization:default",
      "0195E2A1-4C3F-7ABC-8DEF-0123456789AB",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      "10000000-0000-0000-0000-000000000001",
    ]) {
      expect(uuidSchema.safeParse(value).success).toBe(false)
    }
  })
})

describe("uuidCheckPredicate", () => {
  test("uuidSchema と同じ集合を表す", () => {
    const sqlResults = sqlAccepts(uuidProbeValues)
    const disagreements = uuidProbeValues.filter(
      (value, index) => uuidSchema.safeParse(value).success !== sqlResults[index],
    )

    expect(disagreements).toEqual([])
    expect(sqlResults.filter(Boolean).length).toBeGreaterThan(0)
  })

  test("crypto.randomUUID の値を受け入れる", () => {
    const values = Array.from({ length: 200 }, () => crypto.randomUUID())

    expect(sqlAccepts(values).every(Boolean)).toBe(true)
  })

  test("SQL 識別子でない列名を埋め込まない", () => {
    expect(() => uuidCheckPredicate("id) OR (1")).toThrow()
    expect(() => uuidCheckPredicate('"id"')).toThrow()
  })

  test("D1 が拒否する長い GLOB を使わない", () => {
    const predicate = uuidCheckPredicate("id")
    const longestPattern = Math.max(
      ...[...predicate.matchAll(/GLOB '([^']*)'/g)].map((match) => match[1]?.length ?? 0),
    )

    expect(longestPattern).toBeLessThanOrEqual(12)
  })
})
