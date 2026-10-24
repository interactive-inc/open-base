import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import type { RecordProcedureDecisionContext } from "@system/configuration/record-procedure-decision-context"
import type { SystemDatabaseContext } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { RecordRetirementReviewError } from "@system/application/records/errors"
import { RecordRetirementProposalValue } from "@system/domain/values/records/record-retirement-proposal.value"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = RecordProcedureDecisionContext &
  SystemDatabaseContext &
  Readonly<{
    source: Readonly<{ planId: string; sourceNamespace: string; ownerContext: string }>
  }>
type Command = Readonly<{ authentication: SystemReadAuthentication; number: number }>

/** 固定した撤去計画と検査結果を現在の判断資格で開示し、開示前に監査を確定する。 */
export class ReviewRecordRetirementAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: Command) {
    try {
      return await this.review(input)
    } catch (cause) {
      return new RecordRetirementReviewError("unavailable", { cause })
    }
  }

  private async review(input: Command) {
    if (!Number.isSafeInteger(input.number) || input.number < 1)
      return new RecordRetirementReviewError("invalid")
    if (!/^\S{1,255}$/.test(this.c.source.sourceNamespace))
      return new RecordRetirementReviewError("unavailable")
    const authentication = input.authentication
    if (authentication.machineCredentialId !== null)
      return new RecordRetirementReviewError("forbidden")
    const at = this.c.var.now()
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) return new RecordRetirementReviewError("unavailable")
    if (proof === null || !proof.permissionKeys.has("system:procedure:read"))
      return new RecordRetirementReviewError("forbidden")
    const query = new SystemD1ProposalAdapter({
      env: this.c.env,
      visibleCompletionOperationKeys: ["system.record.retire"],
    })
    const proposal = await query.findByNumber(input.number)
    if (proposal instanceof Error) return new RecordRetirementReviewError("unavailable")
    if (proposal === null) return new RecordRetirementReviewError("not_found")
    const value = await RecordRetirementProposalValue.restore(JSON.parse(proposal.bodyJson))
    if (
      value instanceof Error ||
      value.props.digest.toString() !== proposal.digest ||
      value.props.actorAccountId !== proposal.createdByAccountId
    )
      return new RecordRetirementReviewError("unavailable")
    const plan = value.props.plan.snapshot
    if (
      plan.id !== this.c.source.planId ||
      plan.ownerContext !== this.c.source.ownerContext ||
      plan.sourceNamespace !== this.c.source.sourceNamespace
    )
      return new RecordRetirementReviewError("not_found")
    if (
      proposal.status !== "pending" ||
      proposal.currentTaskKey === null ||
      proposal.currentTaskRound === null
    )
      return new RecordRetirementReviewError("conflict")
    const caseGuard = await new PrepareSystemCaseReadGuardAdapter(this.c).prepare({
      caseId: proposal.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (caseGuard instanceof Error) return new RecordRetirementReviewError("unavailable")
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
      return new RecordRetirementReviewError("conflict")
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
    if (decision instanceof RecordRetirementReviewError) return decision
    if (decision instanceof Error || decision.guards.length === 0)
      return new RecordRetirementReviewError("forbidden")
    if (
      decision.actorAccountId !== authentication.accountId ||
      decision.caseId !== proposal.caseId ||
      decision.proposalDigest !== proposal.digest ||
      decision.taskKey !== target.task_key ||
      decision.round !== target.task_round ||
      decision.action !== "approve"
    )
      return new RecordRetirementReviewError("conflict")
    const now = this.c.var.now()
    const technical = proof.assertions(now)
    if (technical instanceof Error) return new RecordRetirementReviewError("forbidden")
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
        plan_id: plan.id,
        plan_digest: value.props.plan.digest,
      }),
      occurredAt: now,
    })
    if (audit instanceof Error) return new RecordRetirementReviewError("unavailable")
    const guards = [...technical, ...decision.guards, caseGuard(now)]
    const recorded = await new SystemAuditEventRepository(this.c).append(audit, guards, guards)
    if (recorded instanceof Error) return new RecordRetirementReviewError("conflict")
    return {
      number: proposal.number,
      status: proposal.status,
      body: value.toReview(),
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
