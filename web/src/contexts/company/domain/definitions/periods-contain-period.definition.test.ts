import { describe, expect, test } from "bun:test"
import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
function period(startsOn: string, endsOn: string | null) {
  return {
    startsOn: restoreCalendarDate(startsOn),
    endsOn: endsOn === null ? null : restoreCalendarDate(endsOn),
  }
}
describe("連続した期間による包含", () => {
  test("隣接する期間をつなぎ、先の終了日がない期間まで覆う", () => {
    expect(
      periodsContainPeriod(
        [period("2026-02-01", null), period("2026-01-01", "2026-02-01")],
        period("2026-01-15", null),
      ),
    ).toBe(true)
  })
  test("一日の空白を後続の期間で隠さない", () => {
    expect(
      periodsContainPeriod(
        [period("2026-01-01", "2026-02-01"), period("2026-02-02", null)],
        period("2026-01-15", null),
      ),
    ).toBe(false)
  })
  test("重なる期間があっても最も先まで確認できた終了日を維持する", () => {
    expect(
      periodsContainPeriod(
        [
          period("2026-01-01", "2026-06-01"),
          period("2026-02-01", "2026-03-01"),
          period("2026-06-01", null),
        ],
        period("2026-01-01", null),
      ),
    ).toBe(true)
  })
  test("終了日の境界は覆えるが、それより先は覆わない", () => {
    const source = [period("2026-01-01", "2026-02-01")]
    expect(periodsContainPeriod(source, period("2026-01-15", "2026-02-01"))).toBe(true)
    expect(periodsContainPeriod(source, period("2026-01-15", "2026-02-02"))).toBe(false)
    expect(periodsContainPeriod(source, period("2026-01-15", null))).toBe(false)
  })
  test("開始前の空白、空の履歴、空区間を拒否する", () => {
    expect(periodsContainPeriod([period("2026-02-01", null)], period("2026-01-01", null))).toBe(
      false,
    )
    expect(periodsContainPeriod([], period("2026-01-01", "2026-02-01"))).toBe(false)
    expect(
      periodsContainPeriod([period("2026-01-01", null)], period("2026-02-01", "2026-02-01")),
    ).toBe(false)
  })
})
