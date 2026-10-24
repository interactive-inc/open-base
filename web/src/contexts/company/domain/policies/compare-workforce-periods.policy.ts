import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"

export function compareWorkforcePeriods(
  left: { startsOn: CalendarDate; periodId: string },
  right: { startsOn: CalendarDate; periodId: string },
): number {
  return left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId)
}
