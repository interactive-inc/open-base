import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import {
  noEmployeeManagementAuthority,
  type EmployeeManagementAuthority,
} from "@/contexts/company/domain/definitions/employee-management-authority.definition"
import { isEligibleWorkforceState } from "@/contexts/company/domain/policies/is-eligible-workforce-state.policy"
import { isInWorkforceManagementChain } from "@/contexts/company/domain/policies/is-in-workforce-management-chain.policy"
import { listWorkforceAssignments } from "@/contexts/company/domain/definitions/list-workforce-assignments.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** 検証済みCompany snapshotだけから、actorの対象Employeeに対する管理範囲を解決する。 */
export function resolveEmployeeManagementAuthority(props: {
  states: ReadonlyArray<WorkforceStateAt>
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  actorEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): EmployeeManagementAuthority {
  if (props.actorEmployeeId === props.targetEmployeeId) return noEmployeeManagementAuthority

  const states = new Map(props.states.map((state) => [state.employeeId, state]))
  const actor = states.get(props.actorEmployeeId)
  const target = states.get(props.targetEmployeeId)
  if (!isEligibleWorkforceState(actor) || !isEligibleWorkforceState(target)) {
    return noEmployeeManagementAuthority
  }

  const targetAssignments = listWorkforceAssignments(target)
  const directManager = props.managementRelations.some(
    (relation) =>
      relation.employeeId === props.targetEmployeeId &&
      relation.managerEmployeeId === props.actorEmployeeId,
  )
  const targetOrganizationUnitIds = new Set(
    targetAssignments.map((assignment) => assignment.organizationUnitId),
  )
  const departmentManager = actor.responsibilities.some(
    (responsibility) =>
      responsibility.responsibilityType === "MANAGER" &&
      targetOrganizationUnitIds.has(responsibility.organizationUnitId),
  )

  return {
    directManager,
    departmentManager,
    managementChain: isInWorkforceManagementChain({
      states,
      managementRelations: props.managementRelations,
      actorEmployeeId: props.actorEmployeeId,
      targetEmployeeId: props.targetEmployeeId,
    }),
  }
}
