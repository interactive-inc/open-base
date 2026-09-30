import type {
  OrganizationalAuthorityAssignmentEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function toOrganizationalAuthorityAssignmentEvidence(
  assignment: OrgAssignmentPeriod,
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"],
): OrganizationalAuthorityAssignmentEvidence {
  return {
    employeeId: assignment.employeeId,
    managerEmployeeId: assignment.managerEmployeeId,
    organizationUnitId: assignment.organizationUnitId,
    assignmentPeriodId: assignment.periodId,
    assignmentRevision: assignment.revision,
    asOf,
  }
}
