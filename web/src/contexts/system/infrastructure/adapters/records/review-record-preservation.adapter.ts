import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { RecordPreservationDecisionContext } from "@system/configuration/record-preservation-decision-context"
import type {
  SystemDatabaseContext,
  SystemAttachmentStorageContext,
} from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordPreservationReviewError } from "@system/application/records/errors"
import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { VerifyPreservedRecordContentAdapter } from "@system/infrastructure/adapters/records/verify-preserved-record-content.adapter"
import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

type Context = RecordPreservationDecisionContext &
  SystemDatabaseContext &
  SystemAttachmentStorageContext
type Command = Readonly<{
  authentication: SystemReadAuthentication
  number: number
  includeOriginal: boolean
}>
/** 判断対象と原文を現在の資格で開示し、返却前に開示監査を確定する。 */
export class ReviewRecordPreservationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: Command) {
    try {
      return await this.review(input)
    } catch (cause) {
      return cause instanceof RecordPreservationReviewError
        ? cause
        : new RecordPreservationReviewError("unavailable", { cause })
    }
  }
  private async review(input: Command) {
    const authentication = input.authentication
    if (authentication.machineCredentialId !== null)
      return new RecordPreservationReviewError("forbidden")
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) throw new RecordPreservationReviewError("unavailable")
    if (proof === null || !proof.permissionKeys.has("system:procedure:read"))
      throw new RecordPreservationReviewError("forbidden")
    const technical = proof.assertions(at)
    if (technical instanceof Error) throw new RecordPreservationReviewError("forbidden")
    const query = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const proposal = await query.findByNumber(input.number)
    if (proposal instanceof Error) throw new RecordPreservationReviewError("unavailable")
    if (proposal === null) throw new RecordPreservationReviewError("not_found")
    const caseGuard = await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
      caseId: proposal.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (caseGuard instanceof Error) throw new RecordPreservationReviewError("unavailable")
    const current = await query.findByNumber(proposal.number)
    if (
      current === null ||
      current instanceof Error ||
      current.caseId !== proposal.caseId ||
      current.status !== proposal.status ||
      current.digest !== proposal.digest ||
      current.currentTaskKey !== proposal.currentTaskKey ||
      current.currentTaskRound !== proposal.currentTaskRound
    )
      throw new RecordPreservationReviewError("conflict")
    const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
    if (!intent.success) throw new RecordPreservationReviewError("unavailable")
    const source = PreservedRecordSourceValue.create(intent.data.source)
    if (source instanceof Error) throw new RecordPreservationReviewError("unavailable")
    if (
      source.props.ownerContext !== this.c.source.ownerContext ||
      source.props.recordKind !== this.c.source.recordKind ||
      source.props.recordId !== this.c.source.recordId ||
      source.props.sourceNamespace !== this.c.source.sourceNamespace
    )
      throw new RecordPreservationReviewError("not_found")
    if (
      proposal.status !== "pending" ||
      proposal.currentTaskKey === null ||
      proposal.currentTaskRound === null
    )
      throw new RecordPreservationReviewError("conflict")
    const target = {
      proposal_version: proposal.version,
      proposal_digest: proposal.digest,
      task_key: proposal.currentTaskKey,
      task_round: proposal.currentTaskRound,
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
      action: "approve",
      decidedAt: at,
    })
    if (decision instanceof RecordPreservationReviewError) return decision
    if (decision instanceof Error || decision.guards.length === 0)
      return new RecordPreservationReviewError("forbidden")
    if (
      decision.actorAccountId !== authentication.accountId ||
      decision.caseId !== proposal.caseId ||
      decision.proposalDigest !== proposal.digest ||
      decision.taskKey !== target.task_key ||
      decision.round !== target.task_round ||
      decision.action !== "approve"
    )
      return new RecordPreservationReviewError("conflict")
    const prepareOriginal = async () => {
      if (!input.includeOriginal) return null
      const value = await RecordPreservationProposalValue.restore(JSON.parse(proposal.bodyJson))
      if (value instanceof Error || value.props.digest.toString() !== proposal.digest)
        throw new RecordPreservationReviewError("unavailable")
      const pending = value.toFinalization({
        actorAccountId: proposal.createdByAccountId,
        at: proposal.createdAt,
      })
      if (pending instanceof Error) throw new RecordPreservationReviewError("unavailable")
      const verified = await new VerifyPreservedRecordContentAdapter(this.c).execute(
        pending.record,
        "pending",
      )
      if (verified instanceof Error) throw new RecordPreservationReviewError("unavailable")
      return {
        source: verified.payload.source.props,
        contentBase64: toBase64(new Uint8Array(verified.payload.content.toBytes())),
        guard: new PrepareAttachmentContentReadGuardAdapter(this.c).prepare(
          verified.attachment,
          this.c.var.now(),
          "pending",
        ),
      }
    }
    const original = await prepareOriginal()
    const now = this.c.var.now()
    const assertions = proof.assertions(now)
    if (assertions instanceof Error) throw new RecordPreservationReviewError("forbidden")
    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemProposalReviewRead,
      targetType: "system:proposal",
      targetId: proposal.proposalId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ required_permission_keys: ["system:procedure:read"] }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        number: proposal.number,
        digest: proposal.digest,
        includes_original: original !== null,
      }),
      occurredAt: now,
    })
    if (audit instanceof Error) throw new RecordPreservationReviewError("unavailable")
    const guards = [
      ...assertions,
      ...decision.guards,
      caseGuard(now),
      ...(original === null ? [] : [original.guard]),
    ]
    const recorded = await new SystemAuditEventRepository(this.c).append(audit, guards, guards)
    if (recorded instanceof Error) throw new RecordPreservationReviewError("conflict")
    return {
      number: proposal.number,
      status: proposal.status,
      body: intent.data,
      original:
        original === null
          ? null
          : { source: original.source, contentBase64: original.contentBase64 },
      decision_target: target,
      procedure: {
        key: proposal.procedureKey,
        revision: proposal.procedureRevision,
        title: proposal.title,
        decision_policy_json: proposal.decisionPolicyJson,
      },
    }
  }
}
