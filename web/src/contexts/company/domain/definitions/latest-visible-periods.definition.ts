import type { LifecyclePeriodBase } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"

/**
 * periodId ごとに最新リビジョンだけを残し、void を除いて開始日・periodId 順に並べる。
 */
export function latestVisiblePeriods<T extends LifecyclePeriodBase>(
  periods: ReadonlyArray<T>,
): ReadonlyArray<T> {
  const latest = new Map<string, T>()

  for (const period of periods) {
    const current = latest.get(period.periodId)

    if (current === undefined || period.revision > current.revision) {
      latest.set(period.periodId, period)
    }
  }

  return [...latest.values()]
    .filter((period) => !period.isVoid)
    .sort(
      (left, right) =>
        left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId),
    )
}
