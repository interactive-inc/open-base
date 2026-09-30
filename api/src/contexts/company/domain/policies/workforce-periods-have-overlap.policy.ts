import { workforcePeriodsOverlap } from "@/contexts/company/domain/policies/workforce-periods-overlap.policy"
import type { WorkforcePeriodVersion } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function workforcePeriodsHaveOverlap<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): boolean {
  return periods.some((left, index) =>
    periods.slice(index + 1).some((right) => workforcePeriodsOverlap(left, right)),
  )
}
