import type { WorkforcePeriodVersion } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

/** outerがinnerの半開区間全体を含むか判定する。 */
export function workforcePeriodContainsPeriod(
  outer: WorkforcePeriodVersion,
  inner: WorkforcePeriodVersion,
): boolean {
  return (
    outer.startsOn <= inner.startsOn &&
    (outer.endsOn === null || (inner.endsOn !== null && inner.endsOn <= outer.endsOn))
  )
}
