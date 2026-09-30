import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforcePeriodVersions(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  if (
    schedule.baselineState !== undefined &&
    (!isCalendarDate(schedule.baselineState.asOf) ||
      (schedule.baselineState.status !== "PRE_HIRE" &&
        schedule.baselineState.status !== "TERMINATED"))
  ) {
    return new WorkforceInvariantViolationValue(
      "invalid_period",
      "workforce baseline state is not canonical",
    )
  }
  const periods = [
    ...schedule.employments,
    ...schedule.statuses,
    ...schedule.assignments,
    ...schedule.responsibilities,
  ]
  const periodIds = new Set<string>()

  for (const period of periods) {
    if (
      !Number.isSafeInteger(period.revision) ||
      period.revision < 1 ||
      !Number.isSafeInteger(period.recordedAt) ||
      period.recordedAt < 0 ||
      !isCalendarDate(period.startsOn) ||
      (period.endsOn !== null &&
        (!isCalendarDate(period.endsOn) || period.startsOn >= period.endsOn))
    ) {
      return new WorkforceInvariantViolationValue(
        "invalid_period",
        "period version is not canonical",
      )
    }
    if (periodIds.has(period.periodId)) {
      return new WorkforceInvariantViolationValue(
        "duplicate_period",
        "schedule contains more than one latest period version",
      )
    }
    periodIds.add(period.periodId)
  }
  return null
}
