import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { isEligibleWorkforceState } from "@/contexts/company/domain/policies/is-eligible-workforce-state.policy"
import { isInWorkforceManagementChain } from "@/contexts/company/domain/policies/is-in-workforce-management-chain.policy"
import { listWorkforceAssignments } from "@/contexts/company/domain/definitions/list-workforce-assignments.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** 検証済みsnapshotから、閲覧者と対象者のApp向け関係を解決する。 */
export function resolveWorkforceEmployeeRelation(props: {
  states: ReadonlyArray<WorkforceStateAt>
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  viewerEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): Readonly<{ isSelf: boolean; isReport: boolean; isSameDepartment: boolean }> {
  if (props.viewerEmployeeId === props.targetEmployeeId) {
    return { isSelf: true, isReport: false, isSameDepartment: false }
  }

  const states = new Map(props.states.map((state) => [state.employeeId, state]))
  const viewer = states.get(props.viewerEmployeeId)
  const target = states.get(props.targetEmployeeId)
  if (!isEligibleWorkforceState(viewer) || !isEligibleWorkforceState(target)) {
    return { isSelf: false, isReport: false, isSameDepartment: false }
  }

  const viewerOrganizationUnitIds = new Set(
    listWorkforceAssignments(viewer).map((assignment) => assignment.organizationUnitId),
  )
  const isSameDepartment = listWorkforceAssignments(target).some((assignment) =>
    viewerOrganizationUnitIds.has(assignment.organizationUnitId),
  )

  return {
    isSelf: false,
    isReport: isInWorkforceManagementChain({
      states,
      managementRelations: props.managementRelations,
      actorEmployeeId: props.viewerEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    }),
    isSameDepartment,
  }
}
