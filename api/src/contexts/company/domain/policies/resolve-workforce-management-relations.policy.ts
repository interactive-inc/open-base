import { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import type {
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityReportingRelationEvidence,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { listAssignmentManagementRelations } from "@/contexts/company/domain/policies/list-assignment-management-relations.policy"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"

/** 未移行の所属と公開関係が同じ管理範囲を所有するときは、重複や上書きを推測しない。 */
export function resolveWorkforceManagementRelations(
  props: Readonly<{
    states: ReadonlyArray<WorkforceStateAt>
    reportingRelations: ReadonlyArray<OrganizationalAuthorityReportingRelationEvidence>
  }>,
): ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence> | OrganizationalAuthorityError {
  const assignments = listAssignmentManagementRelations(props.states)
  const legacyScopes = new Set(
    assignments.map((relation) =>
      JSON.stringify([relation.employeeId, relation.organizationUnitId]),
    ),
  )
  if (
    props.reportingRelations.some((relation) =>
      legacyScopes.has(JSON.stringify([relation.employeeId, relation.organizationUnitId])),
    )
  ) {
    return new OrganizationalAuthorityError("organizational_authority_reporting_source_conflict")
  }
  return [...assignments, ...props.reportingRelations]
}
