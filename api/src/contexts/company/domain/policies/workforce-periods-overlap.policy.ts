import type { WorkforcePeriodVersion } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

/** 2つの半開区間が重なるか判定する。境界の共有は重なりではない。 */
export function workforcePeriodsOverlap(
  left: WorkforcePeriodVersion,
  right: WorkforcePeriodVersion,
): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}
