import { describe, expect, test } from "bun:test"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"

describe("isAbortedByGuard", () => {
  test("意図的なmalformed JSONだけをguard abortとして判定する", () => {
    expect(isAbortedByGuard(new Error("D1_ERROR: malformed JSON"))).toBe(true)
    expect(isAbortedByGuard(new Error("D1_ERROR: constraint failed"))).toBe(false)
    expect(isAbortedByGuard("malformed JSON")).toBe(false)
    expect(isAbortedByGuard(null)).toBe(false)
  })
})
