import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { describe, expect, test } from "bun:test"

describe("CalendarDate", () => {
  test("accepts real canonical dates including leap day", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true)
  })

  test("rejects impossible and non-canonical dates without runtime timezone", () => {
    for (const value of ["0000-01-01", "2025-02-29", "2026-13-01", "2026-1-01"]) {
      expect(isCalendarDate(value)).toBe(false)
    }
  })
})
