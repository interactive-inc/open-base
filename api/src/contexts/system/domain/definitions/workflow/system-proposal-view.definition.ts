import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"

export type SystemProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "returned"
  | "cancelled"
  | "executed"

/** Systemの判断正本から読んだ提案の版と、その案件・判断Taskの現在状態。 */
export type SystemProposalView = Readonly<{
  number: number
  proposalId: string
  supersedesProposalId: string | null
  seriesId: string
  version: number
  procedureKey: string
  procedureRevision: number
  procedureNumber: number
  title: string
  category: string
  description: string | null
  inputSchemaJson: string
  decisionPolicyJson: string
  completionOperationKey: string | null
  bodyJson: string
  digest: ProposalDigest
  createdByAccountId: AccountId
  createdAt: Date
  caseId: string
  status: SystemProposalStatus
  updatedAt: Date
  currentTaskKey: string | null
  currentTaskRound: number | null
  currentTaskOpenedAt: Date | null
  currentTaskDueAt: Date | null
  lastTaskKey: string
  lastTaskRound: number
  lastTaskOutcome: "pending" | "approved" | "rejected" | "returned" | "cancelled"
}>
