import type { RecordRetirementDecisionContext } from "@system/configuration/record-retirement-decision-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordRetirementDecisionError } from "@system/application/records/errors"
import { VerifyRecordProcedureReplayAdapter } from "@system/infrastructure/adapters/records/verify-record-procedure-replay.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { PrepareRecordRetirementRetentionAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-retention.adapter"
import { PrepareRecordRetirementSourceAttachmentsAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-source-attachments.adapter"
import { PrepareRecordRetirementStorageKeysAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-storage-keys.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { ReturnSystemTask } from "@system/application/workflow/return-system-task"

type Context = RecordRetirementDecisionContext
type Command = Readonly<{
  authentication: SystemReadAuthentication
  number: number
  action: "approve" | "reject"
  body: Readonly<{
    decision_target: Readonly<{
      proposal_version: number
      proposal_digest: string
      task_key: string
      task_round: number
    }>
    comment: string | null
  }>
}>
/** 同じ人間・判断対象・コメントの再送だけを受理し、資格を再検査して判断する。 */
export class DecideRecordRetirementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: Command) {
    try {
      return await this.decide(input)
    } catch (cause) {
      return new RecordRetirementDecisionError("unavailable", { cause })
    }
  }
  private async decide(input: Command) {
    const authentication = input.authentication
    const action = input.action
    if (authentication.machineCredentialId !== null)
      return new RecordRetirementDecisionError("forbidden")
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) return new RecordRetirementDecisionError("unavailable")
    if (proof === null || !proof.permissionKeys.has("system:procedure:read"))
      return new RecordRetirementDecisionError("forbidden")
    const technical = proof.assertions(at)
    if (technical instanceof Error) return new RecordRetirementDecisionError("forbidden")
    const query = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.retire"],
    })
    const proposal = await query.findByNumber(input.number)
    if (proposal instanceof Error) return new RecordRetirementDecisionError("unavailable")
    if (proposal === null) return new RecordRetirementDecisionError("not_found")
    const value = await RecordRetirementProposalValue.restore(JSON.parse(proposal.bodyJson))
    if (
      value instanceof Error ||
      value.props.digest.toString() !== proposal.digest ||
      value.props.actorAccountId !== proposal.createdByAccountId
    )
      return new RecordRetirementDecisionError("unavailable")
    const source = value.props.plan.snapshot
    if (
      source.ownerContext !== this.c.source.ownerContext ||
      source.id !== this.c.source.planId ||
      source.sourceNamespace !== this.c.source.sourceNamespace
    )
      return new RecordRetirementDecisionError("not_found")
    const prepareApproval = async (assertions: ReadonlyArray<D1PreparedStatement>) => {
      if (action !== "approve") return assertions
      const context = { env: this.c.env, assertions }
      const target = { planId: source.id, planDigest: value.props.plan.digest }
      const retained = await new PrepareRecordRetirementRetentionAdapter(context).prepare(
        target,
        this.c.var.now(),
      )
      if (retained instanceof Error) return retained
      if (
        retained.coverage.terminalReceiptId !== value.props.terminalReceipt.snapshot.id ||
        retained.coverage.terminalReceiptDigest !== value.props.terminalReceipt.digest
      )
        return new Error("retirement receipt differs from approved target")
      const originals = await new PrepareRecordRetirementSourceAttachmentsAdapter(context).prepare(
        target,
      )
      if (originals instanceof Error) return originals
      const keys = await new PrepareRecordRetirementStorageKeysAdapter(context).prepare(target)
      if (keys instanceof Error) return keys
      return [...assertions, ...retained.assertions, ...originals.assertions, ...keys.assertions]
    }
    const body = input.body
    const target = body.decision_target
    if (proposal.version !== target.proposal_version || proposal.digest !== target.proposal_digest)
      return new RecordRetirementDecisionError("conflict")
    if (
      proposal.status === "pending" ||
      (action === "approve" &&
        (proposal.status === "approved" || proposal.status === "executed")) ||
      (action === "reject" && (proposal.status === "rejected" || proposal.status === "returned"))
    ) {
      const attestations = await query.listAttestations(proposal.caseId)
      if (attestations instanceof Error) return new RecordRetirementDecisionError("unavailable")
      const original = attestations.find(
        (attestation) =>
          attestation.actorAccountId === authentication.accountId &&
          attestation.taskKey === target.task_key &&
          attestation.round === target.task_round &&
          (attestation.action === action ||
            (action === "reject" && attestation.action === "return")) &&
          attestation.comment === body.comment,
      )
      if (original !== undefined) {
        const guard = await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
          caseId: proposal.caseId,
          accountId: authentication.accountId,
          at: this.c.var.now(),
        })
        if (guard instanceof Error) return new RecordRetirementDecisionError("unavailable")
        const current = await query.findByNumber(proposal.number)
        if (
          current === null ||
          current instanceof Error ||
          current.proposalId !== proposal.proposalId ||
          current.status !== proposal.status ||
          current.currentTaskKey !== proposal.currentTaskKey ||
          current.currentTaskRound !== proposal.currentTaskRound
        )
          return new RecordRetirementDecisionError("conflict")
        const now = this.c.var.now()
        const assertions = proof.assertions(now)
        if (assertions instanceof Error) return new RecordRetirementDecisionError("forbidden")
        const qualification = await this.c.prepareReplay({
          proposal,
          attestation: original,
          at: now,
        })
        if (qualification instanceof Error || qualification.guards.length === 0)
          return new RecordRetirementDecisionError("forbidden")
        const approvalGuards = await prepareApproval([
          ...assertions,
          ...qualification.guards,
          guard(now),
        ])
        if (approvalGuards instanceof Error) return new RecordRetirementDecisionError("conflict")
        const verified = await new VerifyRecordProcedureReplayAdapter(this.c).execute(
          approvalGuards,
        )
        if (verified instanceof Error) return new RecordRetirementDecisionError("conflict")
        return { status: proposal.status === "executed" ? "approved" : proposal.status }
      }
      if (proposal.status !== "pending") return new RecordRetirementDecisionError("forbidden")
    }
    const decision = await this.c.prepareDecision({
      proposal,
      decisionTarget: {
        proposalVersion: target.proposal_version,
        proposalDigest: target.proposal_digest,
        taskKey: target.task_key,
        taskRound: target.task_round,
      },
      actorAccountId: authentication.accountId,
      action,
      decidedAt: at,
    })
    if (decision instanceof RecordRetirementDecisionError) return decision
    if (decision instanceof Error || decision.guards.length === 0)
      return new RecordRetirementDecisionError("forbidden")
    if (
      decision.actorAccountId !== authentication.accountId ||
      decision.caseId !== proposal.caseId ||
      decision.proposalDigest !== proposal.digest ||
      decision.taskKey !== target.task_key ||
      decision.round !== target.task_round ||
      (action === "approve"
        ? decision.action !== "approve"
        : !["reject", "return"].includes(decision.action))
    )
      return new RecordRetirementDecisionError("conflict")
    const approvalGuards = await prepareApproval([...technical, ...decision.guards])
    if (approvalGuards instanceof Error) return new RecordRetirementDecisionError("conflict")
    const writer = new SystemD1WorkflowAdapter({
      env: this.c.env,
      decisionGuards: approvalGuards,
    })
    const command = { ...decision, comment: body.comment, decidedAt: at }
    const operation = {
      approve: new ApproveSystemTask(writer),
      reject: new RejectSystemTask(writer),
      return: new ReturnSystemTask(writer),
    }[decision.action]
    if (operation === undefined) return new RecordRetirementDecisionError("unavailable")
    const approved = await operation.execute(command)
    if (approved instanceof Error) return new RecordRetirementDecisionError("conflict")
    return { status: approved.caseStatus }
  }
}
