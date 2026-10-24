import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { RecordPreservationDecisionContext } from "@system/configuration/record-preservation-decision-context"
import type { SystemDatabaseContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordPreservationWithdrawalError } from "@system/application/records/errors"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { recordPreservationIntentSchema } from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = Pick<RecordPreservationDecisionContext, "env" | "var" | "source"> &
  SystemDatabaseContext
type Command = Readonly<{
  authentication: SystemReadAuthentication
  number: number
  proposalDigest: string
  reason: string
}>
/** 申請者の未完了提案だけを取り下げ、理由と取消を同時に保存する。 */
export class WithdrawRecordPreservationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: Command) {
    try {
      return await this.withdraw(input)
    } catch (cause) {
      return cause instanceof RecordPreservationWithdrawalError
        ? cause
        : new RecordPreservationWithdrawalError("unavailable", { cause })
    }
  }
  private async withdraw(input: Command) {
    const authentication = input.authentication
    if (authentication.machineCredentialId !== null)
      return new RecordPreservationWithdrawalError("forbidden")
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) throw new RecordPreservationWithdrawalError("unavailable")
    if (proof === null) throw new RecordPreservationWithdrawalError("forbidden")
    const assertions = proof.assertions(at)
    if (assertions instanceof Error) throw new RecordPreservationWithdrawalError("forbidden")
    const reader = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.preserve"],
    })
    const proposal = await reader.findByNumber(input.number)
    if (proposal instanceof Error) throw new RecordPreservationWithdrawalError("unavailable")
    if (proposal === null) throw new RecordPreservationWithdrawalError("not_found")
    if (proposal.createdByAccountId !== authentication.accountId)
      throw new RecordPreservationWithdrawalError("forbidden")
    if (proposal.status !== "pending" || proposal.digest !== input.proposalDigest)
      throw new RecordPreservationWithdrawalError("conflict")
    const intent = recordPreservationIntentSchema.safeParse(JSON.parse(proposal.bodyJson))
    if (!intent.success) throw new RecordPreservationWithdrawalError("unavailable")
    const source = PreservedRecordSourceValue.create(intent.data.source)
    if (source instanceof Error) throw new RecordPreservationWithdrawalError("unavailable")
    if (
      source.props.ownerContext !== this.c.source.ownerContext ||
      source.props.recordKind !== this.c.source.recordKind ||
      source.props.recordId !== this.c.source.recordId ||
      source.props.sourceNamespace !== this.c.source.sourceNamespace
    )
      throw new RecordPreservationWithdrawalError("not_found")
    const guard = await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
      caseId: proposal.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (guard instanceof Error) throw new RecordPreservationWithdrawalError("unavailable")
    const current = await reader.findByNumber(proposal.number)
    if (
      current === null ||
      current instanceof Error ||
      current.caseId !== proposal.caseId ||
      current.digest !== proposal.digest ||
      current.status !== "pending"
    )
      throw new RecordPreservationWithdrawalError("conflict")

    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordPreservationWithdrawn,
      targetType: "system:case",
      targetId: proposal.caseId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ relation: "applicant" }),
      beforeJson: JSON.stringify({ status: "pending" }),
      afterJson: JSON.stringify({ status: "cancelled" }),
      metadataJson: JSON.stringify({
        proposal_digest: proposal.digest,
        reason: input.reason,
      }),
      occurredAt: at,
    })
    if (audit instanceof Error) throw new RecordPreservationWithdrawalError("unavailable")
    const cancelled = await new CancelSystemProcedure(
      new SystemD1WorkflowAdapter({
        env: this.c.env,
        cancelGuards: [...assertions, guard(at)],
        cancelEffects: new SystemAuditEventRepository(this.c).prepareAppend(audit),
      }),
    ).run({
      number: proposal.number,
      createdByAccountId: authentication.accountId,
      cancelledAt: at,
    })
    if (cancelled !== true) throw new RecordPreservationWithdrawalError("conflict")
    return { status: "cancelled" }
  }
}
