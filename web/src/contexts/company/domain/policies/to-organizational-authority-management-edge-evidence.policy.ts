import type {
  OrganizationalAuthorityManagementEdgeEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { toOrganizationalAuthorityAssignmentEvidence } from "@/contexts/company/domain/policies/to-organizational-authority-assignment-evidence.policy"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function toOrganizationalAuthorityManagementEdgeEvidence(
  assignment: OrgAssignmentPeriod,
  managerEmployeeId: EmployeeId,
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"],
): OrganizationalAuthorityManagementEdgeEvidence {
  return {
    ...toOrganizationalAuthorityAssignmentEvidence(assignment, asOf),
    managerEmployeeId,
  }
}
