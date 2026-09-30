import type { WorkforcePeriodVersion } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function activeWorkforcePeriods<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> {
  return periods.filter((period) => !period.isVoid)
}
