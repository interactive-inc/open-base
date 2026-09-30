import type { OrganizationalAuthorityManagementEdgeEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"

export function compareOrganizationalAuthorityManagementRelations(
  left: OrganizationalAuthorityManagementEdgeEvidence,
  right: OrganizationalAuthorityManagementEdgeEvidence,
): number {
  const leftSource =
    "assignmentPeriodId" in left
      ? `assignment:${left.assignmentPeriodId}`
      : `reporting-relation:${left.reportingRelationId}`
  const rightSource =
    "assignmentPeriodId" in right
      ? `assignment:${right.assignmentPeriodId}`
      : `reporting-relation:${right.reportingRelationId}`
  return (
    left.managerEmployeeId.localeCompare(right.managerEmployeeId) ||
    left.organizationUnitId.localeCompare(right.organizationUnitId) ||
    leftSource.localeCompare(rightSource)
  )
}
