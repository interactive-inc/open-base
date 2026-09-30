import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
type Period = Readonly<{ startsOn: CalendarDate; endsOn: CalendarDate | null }>

/** 隣接する期間をつなぎ、対象期間の途中に空白がないことを確認する。 */
export function periodsContainPeriod(periods: ReadonlyArray<Period>, target: Period): boolean {
  if (target.endsOn !== null && target.endsOn <= target.startsOn) return false
  const coveredUntil = periods
    .toSorted((left, right) => left.startsOn.localeCompare(right.startsOn))
    .reduce<CalendarDate | null>((covered, period) => {
      if (covered === null || period.startsOn > covered) return covered
      if (period.endsOn === null) return null
      return period.endsOn > covered ? period.endsOn : covered
    }, target.startsOn)
  return coveredUntil === null || (target.endsOn !== null && coveredUntil >= target.endsOn)
}
