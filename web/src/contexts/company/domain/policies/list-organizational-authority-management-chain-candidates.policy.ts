import { compareOrganizationalAuthorityManagementRelations } from "@/contexts/company/domain/policies/compare-organizational-authority-management-relations.policy"
import type { OrganizationalAuthorityCandidateEvidence } from "@/contexts/company/domain/definitions/organizational-authority-candidate-evidence.definition"
import type {
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function listOrganizationalAuthorityManagementChainCandidates(props: {
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  subjectEmployeeId: EmployeeId
}): ReadonlyArray<OrganizationalAuthorityCandidateEvidence> {
  const edgesByEmployee = new Map<EmployeeId, OrganizationalAuthorityManagementEdgeEvidence[]>()
  for (const relation of props.managementRelations.toSorted(
    compareOrganizationalAuthorityManagementRelations,
  )) {
    const edges = edgesByEmployee.get(relation.employeeId)
    if (edges === undefined) edgesByEmployee.set(relation.employeeId, [relation])
    else edges.push(relation)
  }

  const pending = (edgesByEmployee.get(props.subjectEmployeeId) ?? []).map((edge) => ({
    employeeId: edge.managerEmployeeId,
    path: [edge],
  }))
  const visited = new Set<EmployeeId>([props.subjectEmployeeId])
  const candidates: OrganizationalAuthorityCandidateEvidence[] = []

  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index]
    if (current === undefined) continue
    if (visited.has(current.employeeId)) continue
    visited.add(current.employeeId)
    candidates.push({
      employeeId: current.employeeId,
      evidence: { kind: "management_chain", path: current.path },
    })
    pending.push(
      ...(edgesByEmployee.get(current.employeeId) ?? []).map((edge) => ({
        employeeId: edge.managerEmployeeId,
        path: [...current.path, edge],
      })),
    )
  }

  return candidates
}
