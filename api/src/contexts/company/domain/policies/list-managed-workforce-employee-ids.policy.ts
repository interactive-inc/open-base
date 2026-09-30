import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/policies/resolve-employee-management-authority.policy"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** 検証済みCompany snapshotだけから、actorが管理できるEmployee IDを決定的に返す。 */
export function listManagedWorkforceEmployeeIds(props: {
  states: ReadonlyArray<WorkforceStateAt>
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  actorEmployeeId: EmployeeId
}): ReadonlyArray<EmployeeId> {
  return props.states
    .map((state) => state.employeeId)
    .filter((employeeId) => employeeId !== props.actorEmployeeId)
    .filter((employeeId) => {
      const authority = resolveEmployeeManagementAuthority({
        states: props.states,
        managementRelations: props.managementRelations,
        actorEmployeeId: props.actorEmployeeId,
        targetEmployeeId: employeeId,
      })
      return authority.managementChain || authority.departmentManager
    })
    .toSorted()
}
