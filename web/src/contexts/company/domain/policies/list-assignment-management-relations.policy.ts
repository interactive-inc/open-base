import { listWorkforceStateAssignments } from "@/contexts/company/domain/definitions/list-workforce-state-assignments.definition"
import type { OrganizationalAuthorityManagementEdgeEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import { toOrganizationalAuthorityManagementEdgeEvidence } from "@/contexts/company/domain/policies/to-organizational-authority-management-edge-evidence.policy"

/** 既存の所属に記録された指揮命令を、元のperiodとrevisionを保持して渡す。 */
export function listAssignmentManagementRelations(
  states: ReadonlyArray<WorkforceStateAt>,
): ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence> {
  return states.flatMap((state) =>
    listWorkforceStateAssignments(state).flatMap((assignment) =>
      assignment.managerEmployeeId === null
        ? []
        : [
            toOrganizationalAuthorityManagementEdgeEvidence(
              assignment,
              assignment.managerEmployeeId,
              state.asOf,
            ),
          ],
    ),
  )
}
