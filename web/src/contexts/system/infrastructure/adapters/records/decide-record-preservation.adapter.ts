import type { RecordPreservationDecisionContext } from "@system/configuration/record-preservation-decision-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordPreservationDecisionError } from "@system/application/records/errors"
import { VerifyRecordProcedureReplayAdapter } from "@system/infrastructure/adapters/records/verify-record-procedure-replay.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { ReturnSystemTask } from "@system/application/workflow/return-system-task"

type Context = RecordPreservationDecisionContext
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
export class DecideRecordPreservationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: Command) {
    try {
      return await this.decide(input)
    } catch (cause) {
      return new RecordPreservationDecisionError("unavailable", { cause })
    }
  }
  private async decide(input: Command) {
    const { authentication, action } = input
    if (authentication.machineCredentialId !== null)
      return new RecordPreservationDecisionError("forbidden")
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) return new RecordPreservationDecisionError("unavailable")
    if (proof === null) return new RecordPreservationDecisionError("forbidden")
    const technical = proof.assertions(at)
    if (technical instanceof Error) return new RecordPreservationDecisionError("forbidden")
    const query = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const proposal = await query.findByNumber(input.number)
    if (proposal instanceof Error) return new RecordPreservationDecisionError("unavailable")
    if (proposal === null) return new RecordPreservationDecisionError("not_found")
    const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
    if (!intent.success) return new RecordPreservationDecisionError("unavailable")
    const source = PreservedRecordSourceValue.create(intent.data.source)
    if (source instanceof Error) return new RecordPreservationDecisionError("unavailable")
    if (
      source.props.ownerContext !== this.c.source.ownerContext ||
      source.props.recordKind !== this.c.source.recordKind ||
      source.props.recordId !== this.c.source.recordId ||
      source.props.sourceNamespace !== this.c.source.sourceNamespace
    )
      return new RecordPreservationDecisionError("not_found")
    const body = input.body
    const target = body.decision_target
    if (proposal.version !== target.proposal_version || proposal.digest !== target.proposal_digest)
      return new RecordPreservationDecisionError("conflict")
    if (
      proposal.status === "pending" ||
      (action === "approve" &&
        (proposal.status === "approved" || proposal.status === "executed")) ||
      (action === "reject" && (proposal.status === "rejected" || proposal.status === "returned"))
    ) {
      const attestations = await query.listAttestations(proposal.caseId)
      if (attestations instanceof Error) return new RecordPreservationDecisionError("unavailable")
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
        if (guard instanceof Error) return new RecordPreservationDecisionError("unavailable")
        const current = await query.findByNumber(proposal.number)
        if (
          current === null ||
          current instanceof Error ||
          current.proposalId !== proposal.proposalId ||
          current.status !== proposal.status ||
          current.currentTaskKey !== proposal.currentTaskKey ||
          current.currentTaskRound !== proposal.currentTaskRound
        )
          return new RecordPreservationDecisionError("conflict")
        const now = this.c.var.now()
        const assertions = proof.assertions(now)
        if (assertions instanceof Error) return new RecordPreservationDecisionError("forbidden")
        const verified = await new VerifyRecordProcedureReplayAdapter(this.c).execute([
          ...assertions,
          guard(now),
        ])
        if (verified instanceof Error) return new RecordPreservationDecisionError("conflict")
        return { status: proposal.status === "executed" ? "approved" : proposal.status }
      }
      if (proposal.status !== "pending") return new RecordPreservationDecisionError("forbidden")
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
    if (decision instanceof RecordPreservationDecisionError) return decision
    if (decision instanceof Error || decision.guards.length === 0)
      return new RecordPreservationDecisionError("forbidden")
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
      return new RecordPreservationDecisionError("conflict")
    const writer = new SystemD1WorkflowAdapter({
      env: this.c.env,
      decisionGuards: [...technical, ...decision.guards],
    })
    const command = { ...decision, comment: body.comment, decidedAt: at }
    const operation = {
      approve: new ApproveSystemTask(writer),
      reject: new RejectSystemTask(writer),
      return: new ReturnSystemTask(writer),
    }[decision.action]
    if (operation === undefined) return new RecordPreservationDecisionError("unavailable")
    const approved = await operation.execute(command)
    if (approved instanceof Error) return new RecordPreservationDecisionError("conflict")
    return { status: approved.caseStatus }
  }
}
