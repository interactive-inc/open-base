import type { LifecyclePeriodBase } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"

/**
 * 半開区間 [startsOn, endsOn) に date が含まれるか判定する。endsOn が null なら無期限。
 */
export function containsDate(period: LifecyclePeriodBase, date: string): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}
