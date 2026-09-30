import { describe, expect, test } from "bun:test"
import { isEntityIdSegment } from "@/lib/is-entity-id-segment"

describe("isEntityIdSegment", () => {
  test("整数IDとUUIDを受け付ける", () => {
    expect(isEntityIdSegment("42")).toBe(true)
    expect(isEntityIdSegment("0b7a3c1e-2f4d-4e5a-9b8c-7d6e5f4a3b2c")).toBe(true)
  })

  test("pathを変える値と空文字と長すぎる値を拒否する", () => {
    expect(isEntityIdSegment("")).toBe(false)
    expect(isEntityIdSegment("../admin")).toBe(false)
    expect(isEntityIdSegment("1/cancel")).toBe(false)
    expect(isEntityIdSegment("1?x=1")).toBe(false)
    expect(isEntityIdSegment("a".repeat(129))).toBe(false)
  })
})
