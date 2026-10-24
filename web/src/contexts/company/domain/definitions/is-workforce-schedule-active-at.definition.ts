import { activeWorkforcePeriods } from "@/contexts/company/domain/policies/active-workforce-periods.policy"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function isWorkforceScheduleActiveAt(
  schedule: WorkforceLifecycleSchedule,
  date: CalendarDate,
): boolean {
  return activeWorkforcePeriods(schedule.statuses).some(
    (status) =>
      (status.status === "ACTIVE" || status.status === "ON_LEAVE") &&
      periodContainsDate(status, date),
  )
}
