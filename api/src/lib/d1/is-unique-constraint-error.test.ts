import { isUniqueConstraintError } from "@/lib/d1/is-unique-constraint-error"
import { describe, expect, test } from "bun:test"

describe("isUniqueConstraintError", () => {
  test("detects bun:sqlite structured code", () => {
    const error = Object.assign(new Error("UNIQUE constraint failed: payslips.employee_id"), {
      code: "SQLITE_CONSTRAINT_UNIQUE",
    })

    expect(isUniqueConstraintError(error)).toBe(true)
  })

  test("detects code nested under cause", () => {
    const cause = Object.assign(new Error("constraint"), { code: "SQLITE_CONSTRAINT_UNIQUE" })

    const error = new Error("wrapped", { cause })

    expect(isUniqueConstraintError(error)).toBe(true)
  })

  test("detects D1 style message without a structured code", () => {
    const error = new Error(
      "D1_ERROR: UNIQUE constraint failed: payslips.employee_id, payslips.period",
    )

    expect(isUniqueConstraintError(error)).toBe(true)
  })

  test("ignores unrelated constraint failures", () => {
    const error = Object.assign(new Error("NOT NULL constraint failed: payslips.period"), {
      code: "SQLITE_CONSTRAINT_NOTNULL",
    })

    expect(isUniqueConstraintError(error)).toBe(false)
  })

  test("ignores a D1 NOT NULL message that exposes no structured code", () => {
    const error = new Error("D1_ERROR: NOT NULL constraint failed: payslips.period")

    expect(isUniqueConstraintError(error)).toBe(false)
  })

  test("ignores non-error values", () => {
    expect(isUniqueConstraintError(null)).toBe(false)
    expect(isUniqueConstraintError("UNIQUE constraint failed")).toBe(false)
    expect(isUniqueConstraintError(undefined)).toBe(false)
  })
})
