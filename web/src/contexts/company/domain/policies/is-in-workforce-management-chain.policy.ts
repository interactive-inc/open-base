import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { isEligibleWorkforceState } from "@/contexts/company/domain/policies/is-eligible-workforce-state.policy"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function isInWorkforceManagementChain(props: {
  states: ReadonlyMap<EmployeeId, WorkforceStateAt>
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  actorEmployeeId: EmployeeId
  targetEmployeeId: EmployeeId
}): boolean {
  const target = props.states.get(props.targetEmployeeId)
  if (!isEligibleWorkforceState(target)) return false

  const managersByEmployee = new Map<EmployeeId, EmployeeId[]>()
  for (const relation of props.managementRelations) {
    const managers = managersByEmployee.get(relation.employeeId)
    if (managers === undefined)
      managersByEmployee.set(relation.employeeId, [relation.managerEmployeeId])
    else managers.push(relation.managerEmployeeId)
  }
  const pending = [...(managersByEmployee.get(props.targetEmployeeId) ?? [])]
  const visited = new Set<EmployeeId>([props.targetEmployeeId])

  for (let index = 0; index < pending.length; index += 1) {
    const managerEmployeeId = pending[index]
    if (managerEmployeeId === undefined || visited.has(managerEmployeeId)) continue
    if (managerEmployeeId === props.actorEmployeeId) return true

    visited.add(managerEmployeeId)
    const manager = props.states.get(managerEmployeeId)
    if (!isEligibleWorkforceState(manager)) continue
    pending.push(...(managersByEmployee.get(managerEmployeeId) ?? []))
  }

  return false
}
