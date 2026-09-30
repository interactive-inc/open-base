import { DecisionTaskCandidateEntity } from "@system/domain/entities/decision-task-candidate.entity"
import { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import type { SystemCaseEntity } from "@system/domain/entities/system-case.entity"
import { InvalidSystemWorkflowError } from "@system/domain/errors"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { ProposalDigest } from "@system/domain/schemas/workflow/system-case-reference.schema"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"

export type StartSystemProcedureTaskCandidate = Readonly<{
  accountId: AccountId
  source: "primary" | "escalation"
  evidenceContext: string
  evidenceKind: string
  evidenceId: string
  evidenceVersion: string
  eligibilityDigest: ProposalDigest
  eligibleFrom: Date | null
  resolvedAt: Date
}>

export type StartSystemProcedureTask = Readonly<{
  key: string
  requiredApprovals: number
  requiredParticipants?: number
  negativeDecisionRule?: "any-reject" | "approval-impossible"
  delegationPolicy?: "allowed" | "forbidden"
  returnPolicy?: "allowed" | "forbidden"
  openedAt: Date
  dueAt: Date | null
  candidates: ReadonlyArray<StartSystemProcedureTaskCandidate>
  excludedAccountIds: ReadonlyArray<AccountId>
}>

/** 解決済み候補を検証し、一つのSystem判断Taskへ変換する。 */
export function createSystemDecisionTask(
  input: Readonly<{
    task: StartSystemProcedureTask
    caseId: SystemCaseEntity["id"]
    createdByAccountId: AccountId
    proposalDigest: ProposalDigest
    round?: number
  }>,
): SystemDecisionTaskBundle | InvalidSystemWorkflowError {
  const candidates: DecisionTaskCandidateEntity[] = []
  for (const candidateInput of input.task.candidates) {
    const candidate = DecisionTaskCandidateEntity.create(candidateInput)
    if (candidate instanceof InvalidSystemWorkflowError) return candidate
    candidates.push(candidate)
  }
  const excludedAccountIds = [
    ...new Set([input.createdByAccountId, ...input.task.excludedAccountIds]),
  ]
  const task = DecisionTaskEntity.create({
    caseId: input.caseId,
    key: input.task.key,
    round: input.round ?? 1,
    candidateAccountIds: candidates.map((candidate) => candidate.accountId),
    excludedAccountIds,
    requiredApprovals: input.task.requiredApprovals,
    requiredParticipants: input.task.requiredParticipants ?? input.task.requiredApprovals,
    negativeDecisionRule: input.task.negativeDecisionRule ?? "any-reject",
    delegationPolicy: input.task.delegationPolicy ?? "allowed",
    returnPolicy: input.task.returnPolicy ?? "allowed",
    proposalDigest: input.proposalDigest,
    openedAt: input.task.openedAt,
    dueAt: input.task.dueAt,
  })
  if (task instanceof InvalidSystemWorkflowError) return task

  return {
    task,
    candidates,
    exclusions: excludedAccountIds.map((accountId) => ({
      accountId,
      reason: accountId === input.createdByAccountId ? "creator" : "policy",
    })),
  }
}
