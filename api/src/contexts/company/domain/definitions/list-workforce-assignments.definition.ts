import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function listWorkforceAssignments(
  state: WorkforceStateAt,
): ReadonlyArray<OrgAssignmentPeriod> {
  return [
    ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
    ...state.concurrentAssignments,
  ]
}
