import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { resolveEmployeeManagementAuthority } from "@/contexts/company/domain/policies/resolve-employee-management-authority.policy"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** 管理ラインだけを対象に、actorの配下Employee IDを返す。 */
export function listReportWorkforceEmployeeIds(props: {
  states: ReadonlyArray<WorkforceStateAt>
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  actorEmployeeId: EmployeeId
}): ReadonlyArray<EmployeeId> {
  return props.states
    .map((state) => state.employeeId)
    .filter((employeeId) => employeeId !== props.actorEmployeeId)
    .filter(
      (employeeId) =>
        resolveEmployeeManagementAuthority({
          states: props.states,
          managementRelations: props.managementRelations,
          actorEmployeeId: props.actorEmployeeId,
          targetEmployeeId: employeeId,
        }).managementChain,
    )
    .toSorted()
}
