import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function compareOrganizationalAuthorityAssignments(
  left: OrgAssignmentPeriod,
  right: OrgAssignmentPeriod,
): number {
  return (
    String(left.managerEmployeeId).localeCompare(String(right.managerEmployeeId)) ||
    left.organizationUnitId.localeCompare(right.organizationUnitId) ||
    left.periodId.localeCompare(right.periodId)
  )
}
