import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { RecordRetirementDecisionContext } from "@system/configuration/record-retirement-decision-context"
import type { SystemDatabaseContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordRetirementWithdrawalError } from "@system/application/records/errors"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { CancelSystemProcedure } from "@system/application/workflow/cancel-system-procedure"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = Pick<RecordRetirementDecisionContext, "env" | "var" | "source"> &
  SystemDatabaseContext
type Command = Readonly<{
  authentication: SystemReadAuthentication
  number: number
  proposalVersion: number
  proposalDigest: string
  reason: string
}>
/** 申請者の未完了提案だけを取り下げ、理由と取消を同時に保存する。 */
export class WithdrawRecordRetirementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  async execute(input: Command) {
    try {
      return await this.withdraw(input)
    } catch (cause) {
      return cause instanceof RecordRetirementWithdrawalError
        ? cause
        : new RecordRetirementWithdrawalError("unavailable", { cause })
    }
  }
  private async withdraw(input: Command) {
    const authentication = input.authentication
    if (authentication.machineCredentialId !== null)
      return new RecordRetirementWithdrawalError("forbidden")
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) return new RecordRetirementWithdrawalError("unavailable")
    if (proof === null) return new RecordRetirementWithdrawalError("forbidden")
    const assertions = proof.assertions(at)
    if (assertions instanceof Error) return new RecordRetirementWithdrawalError("forbidden")
    const reader = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.retire"],
    })
    const proposal = await reader.findByNumber(input.number)
    if (proposal instanceof Error) return new RecordRetirementWithdrawalError("unavailable")
    if (proposal === null) return new RecordRetirementWithdrawalError("not_found")
    if (proposal.createdByAccountId !== authentication.accountId)
      return new RecordRetirementWithdrawalError("forbidden")
    const value = await RecordRetirementProposalValue.restore(JSON.parse(proposal.bodyJson))
    if (
      value instanceof Error ||
      value.props.digest.toString() !== proposal.digest ||
      value.props.actorAccountId !== authentication.accountId
    )
      return new RecordRetirementWithdrawalError("unavailable")
    const source = value.props.plan.snapshot
    if (
      source.ownerContext !== this.c.source.ownerContext ||
      source.id !== this.c.source.planId ||
      source.sourceNamespace !== this.c.source.sourceNamespace
    )
      return new RecordRetirementWithdrawalError("not_found")
    if (
      proposal.status !== "pending" ||
      proposal.version !== input.proposalVersion ||
      proposal.digest !== input.proposalDigest
    )
      return new RecordRetirementWithdrawalError("conflict")
    const guard = await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
      caseId: proposal.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (guard instanceof Error) return new RecordRetirementWithdrawalError("unavailable")
    const current = await reader.findByNumber(proposal.number)
    if (
      current === null ||
      current instanceof Error ||
      current.caseId !== proposal.caseId ||
      current.digest !== proposal.digest ||
      current.status !== "pending"
    )
      return new RecordRetirementWithdrawalError("conflict")

    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordRetirementWithdrawn,
      targetType: "system:case",
      targetId: proposal.caseId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ relation: "applicant" }),
      beforeJson: JSON.stringify({ status: "pending" }),
      afterJson: JSON.stringify({ status: "cancelled" }),
      metadataJson: JSON.stringify({
        proposal_version: proposal.version,
        proposal_digest: proposal.digest,
        reason: input.reason,
      }),
      occurredAt: at,
    })
    if (audit instanceof Error) return new RecordRetirementWithdrawalError("unavailable")
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
    if (cancelled !== true) return new RecordRetirementWithdrawalError("conflict")
    return { status: "cancelled" }
  }
}
