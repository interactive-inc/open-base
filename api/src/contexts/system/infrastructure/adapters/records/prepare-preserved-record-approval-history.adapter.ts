import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordExecutionProofValue } from "@system/domain/values/records/preserved-record-execution-proof.value"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import { canReadSystemProposalHistory } from "@system/domain/policies/can-read-system-proposal-history.policy"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { PreparePreservedRecordAttestationsAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-attestations.adapter"
import { PreparePreservedRecordCandidatesAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-candidates.adapter"
import { PreparePreservedRecordDelegationsAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-delegations.adapter"
import { PreparePreservedRecordTasksAdapter } from "@system/infrastructure/adapters/records/prepare-preserved-record-tasks.adapter"
import { DecisionTaskEntity } from "@system/domain/entities/decision-task.entity"
import { HumanAttestationEntity } from "@system/domain/entities/human-attestation.entity"

type Context = SystemD1Context
type Input = Readonly<{
  proof: PreservedRecordExecutionProofValue
  accountId: string
  permissionKeys: ReadonlySet<string>
  at: Date
}>

/** 原文の開示資格とは別に、確定した提案版の履歴と応答直前に使う検査を準備する。 */
export class PreparePreservedRecordApprovalHistoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input) {
    if (!input.permissionKeys.has(SystemFeaturePermission.PROCEDURE_READ.key))
      return new PreservedRecordDisclosureDeniedError()
    const proof = input.proof.props
    const creator = zAccountId.safeParse(proof.executedByAccountId)
    if (!creator.success) return new Error("record approval creator is invalid")
    const guard = await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
      caseId: proof.caseId,
      accountId: input.accountId,
      at: input.at,
    })
    if (guard instanceof Error) return guard
    const reader = new SystemD1ProposalAdapter(this.c)
    const proposal = await reader.findBySeriesVersion({
      seriesId: proof.proposalSeriesId,
      version: proof.proposalVersion,
      creatorAccountId: creator.data,
    })
    if (proposal instanceof Error) return proposal
    if (
      proposal === null ||
      proposal.proposalId !== proof.proposalId ||
      proposal.caseId !== proof.caseId ||
      proposal.digest !== proof.proposalDigest ||
      proposal.status !== "executed" ||
      proposal.updatedAt.toISOString() !== proof.executedAt ||
      proposal.completionOperationKey !== "system.record.preserve"
    )
      return new Error("record approval history does not match execution proof")
    const decisions = await new PreparePreservedRecordAttestationsAdapter(this.c).prepare({
      caseId: proof.caseId,
      proposalDigest: proof.proposalDigest,
    })
    if (decisions instanceof Error) return decisions
    const attestations = decisions.attestations
    const evidence = await new PreparePreservedRecordCandidatesAdapter(this.c).prepare(proof.caseId)
    if (evidence instanceof Error) return evidence
    const taskHistory = await new PreparePreservedRecordTasksAdapter(this.c).prepare(proof)
    if (taskHistory instanceof Error) return taskHistory
    const tasks = taskHistory.tasks
    if (
      !canReadSystemProposalHistory({
        permissionKeys: input.permissionKeys,
        accountId: input.accountId,
        createdByAccountId: proposal.createdByAccountId,
        attestations,
      })
    )
      return new PreservedRecordDisclosureDeniedError()
    for (const row of [...evidence.candidates, ...evidence.exclusions]) {
      if (!tasks.some((task) => task.key === row.taskKey && task.round === row.round))
        return new Error("record candidate task is missing")
    }
    for (const attestation of attestations) {
      if (
        !evidence.candidates.some(
          (candidate) =>
            candidate.taskKey === attestation.taskKey &&
            candidate.round === attestation.round &&
            candidate.accountId === attestation.representedAccountId,
        )
      )
        return new Error("record attestation qualification is missing")
    }
    for (const task of tasks) {
      const candidates = evidence.candidates.filter(
        (candidate) => candidate.taskKey === task.key && candidate.round === task.round,
      )
      const exclusions = evidence.exclusions.filter(
        (exclusion) => exclusion.taskKey === task.key && exclusion.round === task.round,
      )
      const decisionTask = DecisionTaskEntity.create({
        caseId: proof.caseId,
        key: task.key,
        round: task.round,
        candidateAccountIds: candidates.map((candidate) => candidate.accountId),
        excludedAccountIds: exclusions.map((exclusion) => exclusion.accountId),
        requiredApprovals: task.requiredApprovals,
        requiredParticipants: task.requiredParticipants,
        negativeDecisionRule: task.negativeDecisionRule,
        delegationPolicy: task.delegationPolicy,
        returnPolicy: task.returnPolicy,
        proposalDigest: task.proposalDigest,
        openedAt: task.openedAt,
        dueAt: task.dueAt,
      })
      if (decisionTask instanceof Error) return decisionTask
      const decisions: HumanAttestationEntity[] = []
      for (const attestation of attestations.filter(
        (decision) => decision.taskKey === task.key && decision.round === task.round,
      )) {
        const decision = HumanAttestationEntity.create(attestation)
        if (decision instanceof Error) return decision
        const candidate = candidates.find(
          (candidate) => candidate.accountId === decision.representedAccountId,
        )
        if (
          candidate === undefined ||
          candidate.resolvedAt > decision.decidedAt ||
          (candidate.eligibleFrom !== null && candidate.eligibleFrom > decision.decidedAt) ||
          decision.decidedAt < task.openedAt ||
          decision.decidedAt > task.closedAt ||
          exclusions.some((exclusion) => exclusion.accountId === decision.actorAccountId)
        )
          return new Error("record attestation does not match task eligibility")
        decisions.push(decision)
      }
      const outcome = decisionTask.evaluate(decisions)
      if (outcome instanceof Error) return outcome
      if (task.outcome !== "cancelled" && outcome !== task.outcome)
        return new Error("record task outcome does not match attestations")
    }
    const delegationHistory = await new PreparePreservedRecordDelegationsAdapter(this.c).prepare({
      caseId: proof.caseId,
      subject: { context: "system", kind: "record-preservation", id: proof.recordId, version: "1" },
      procedureKey: proposal.procedureKey,
      attestations,
    })
    if (delegationHistory instanceof Error) return delegationHistory
    return Object.freeze({
      proposal,
      tasks,
      attestations,
      guard,
      attestationsGuard: decisions.guard,
      candidates: evidence.candidates,
      exclusions: evidence.exclusions,
      candidatesGuard: evidence.guard,
      delegations: delegationHistory.delegations,
      delegationsGuard: delegationHistory.guard,
      tasksGuard: taskHistory.guard,
    })
  }
}
