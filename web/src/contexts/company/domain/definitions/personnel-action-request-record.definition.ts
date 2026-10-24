import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type PersonnelActionRequestStatus = "pending" | "approved" | "rejected" | "withdrawn"

export type PersonnelActionRequestRecord = Readonly<{
  id: string
  applicationId: number
  systemProposalSeriesId: string
  systemCaseId: string
  proposalDigest: string
  targetEmployeeId: EmployeeId | null
  targetEmployeeCode: string
  targetEmployeeName: string
  targetDepartmentCode: string | null
  kind: string
  action: PersonnelActionInput
  payloadFingerprint: string
  requestedByEmployeeId: EmployeeId
  requestedByEmployeeCode: string
  requestedByEmployeeName: string
  baseEmployeeRevision: number
  baseOrganizationRevision: number | null
  baseCompanyRevision: number | null
  status: PersonnelActionRequestStatus
  currentStep: string | null
  createdAt: number
  appliedActionId: string | null
  withdrawnAt: number | null
}>
