import { latestVisiblePeriods } from "@/contexts/company/domain/definitions/latest-visible-periods.definition"
import type {
  LifecyclePeriodBase,
  LifecycleSchedule,
  LifecycleVersionMutation,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { normalizeLifecycleSchedule } from "@/contexts/company/domain/definitions/normalize-lifecycle-schedule.definition"

function applyPeriodMutation<T extends LifecyclePeriodBase>(
  periods: ReadonlyArray<T>,
  after: T,
): ReadonlyArray<T> {
  const next = periods.filter((period) => period.periodId !== after.periodId)

  if (!after.isVoid) {
    next.push(after)
  }

  return latestVisiblePeriods(next)
}

/**
 * 正規化済みスケジュールに版差分を適用する。入力は変更しない。
 */
export function applyLifecycleMutations(
  schedule: LifecycleSchedule,
  mutations: ReadonlyArray<LifecycleVersionMutation>,
): LifecycleSchedule {
  let next = normalizeLifecycleSchedule(schedule)

  for (const mutation of mutations) {
    switch (mutation.periodType) {
      case "employment":
        next = {
          ...next,
          employments: applyPeriodMutation(next.employments, mutation.after),
        }
        break
      case "status":
        next = {
          ...next,
          statuses: applyPeriodMutation(next.statuses, mutation.after),
        }
        break
      case "assignment":
        next = {
          ...next,
          assignments: applyPeriodMutation(next.assignments, mutation.after),
        }
        break
      case "responsibility":
        next = {
          ...next,
          responsibilities: applyPeriodMutation(next.responsibilities, mutation.after),
        }
        break
    }
  }

  return next
}
