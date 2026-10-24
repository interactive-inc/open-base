import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { isWorkforceScheduleActiveAt } from "@/contexts/company/domain/definitions/is-workforce-schedule-active-at.definition"
import { listActiveWorkforceManagerRelations } from "@/contexts/company/domain/policies/list-active-workforce-manager-relations.policy"
import { listWorkforceScheduleBoundaryDates } from "@/contexts/company/domain/definitions/list-workforce-schedule-boundary-dates.definition"
import { workforceManagerRelationsHaveCycle } from "@/contexts/company/domain/policies/workforce-manager-relations-have-cycle.policy"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforceManagers(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
): WorkforceInvariantViolation | null {
  for (const date of listWorkforceScheduleBoundaryDates(schedules)) {
    const relations = listActiveWorkforceManagerRelations(schedules, date)
    for (const relation of relations) {
      const manager = schedules.find(
        (schedule) => schedule.employeeId === relation.managerEmployeeId,
      )
      if (manager === undefined || !isWorkforceScheduleActiveAt(manager, date)) {
        return new WorkforceInvariantViolationValue(
          "manager_not_active",
          "manager is not active on assignment date",
        )
      }
    }
    if (workforceManagerRelationsHaveCycle(relations)) {
      return new WorkforceInvariantViolationValue(
        "manager_cycle",
        "management chain contains a cycle",
      )
    }
  }
  return null
}
