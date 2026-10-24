import type { LifecyclePeriodBase } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"

/**
 * container の半開区間が nested を完全に包含するか判定する。
 */
export function periodContainsPeriod(
  container: LifecyclePeriodBase,
  nested: LifecyclePeriodBase,
): boolean {
  return (
    container.startsOn <= nested.startsOn &&
    (container.endsOn === null || (nested.endsOn !== null && nested.endsOn <= container.endsOn))
  )
}
