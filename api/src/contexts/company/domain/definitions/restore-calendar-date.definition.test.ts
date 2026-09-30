import { InvalidCalendarDateError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { expect, test } from "bun:test"

test("実在する暦日を復元する", () => {
  expect(String(restoreCalendarDate("2026-12-31"))).toBe("2026-12-31")
})

test("不正な暦日の復元を拒否する", () => {
  for (const value of ["0000-01-01", "2025-02-29", "2026-13-01", "2026-1-01"]) {
    expect(() => restoreCalendarDate(value)).toThrow(InvalidCalendarDateError)
  }
})
