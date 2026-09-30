import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type WorkflowStepCandidateSnapshot = Readonly<{
  employeeId: EmployeeId
  accountId: AccountId
  source: "primary" | "escalation"
  selectorsJson: string
  eligibleFrom: string | null
  resolvedAt: string
}>

export type WorkflowStepSnapshotDraft = Readonly<{
  requiredApprovals: number
  activatedAt: string
  dueAt: string | null
  escalatedAt: string | null
  resolutionReason: "activation" | "initialization" | "manual_repair"
  resolutionId: string
  candidates: ReadonlyArray<WorkflowStepCandidateSnapshot>
}>
