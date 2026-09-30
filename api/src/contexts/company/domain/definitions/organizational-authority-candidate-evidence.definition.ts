import type { OrganizationalAuthorityEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type OrganizationalAuthorityCandidateEvidence = Readonly<{
  employeeId: EmployeeId
  evidence: OrganizationalAuthorityEvidence
}>
