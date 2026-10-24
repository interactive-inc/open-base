import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import {
  SystemForbiddenError,
  SystemNotFoundError,
  SystemProposalHistoryUnavailableError,
} from "@system/interface/errors"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { PrepareSystemCaseReadGuardAdapter } from "@system/infrastructure/adapters/workflow/prepare-system-case-read-guard.adapter"
import { canReadSystemProposalHistory } from "@system/domain/policies/can-read-system-proposal-history.policy"
import { ProposalEntity } from "@system/domain/entities/proposal.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"

// @authorization service - 明示した閲覧権限・申請判断の関係・開示監査を満たす提案版だけを読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "param",
    z.object({
      number: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      version: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    }),
  ),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const authentication = context.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const at = context.var.now()
    const authorization = await new PrepareSystemReadAuthorizationAdapter(context).prepare(
      authentication,
      at,
    )
    if (authorization instanceof Error) throw new SystemProposalHistoryUnavailableError()
    if (
      authorization === null ||
      !authorization.permissionKeys.has(SystemFeaturePermission.PROCEDURE_READ.key)
    )
      throw new SystemForbiddenError()
    const parameters = context.req.valid("param")
    const reader = new SystemD1ProposalAdapter(context)
    const located = await reader.findByNumber(parameters.number, parameters.version)
    if (located instanceof Error) throw new SystemProposalHistoryUnavailableError()
    if (located === null) throw new SystemNotFoundError()
    const guard = await new PrepareSystemCaseReadGuardAdapter(context).prepare({
      caseId: located.caseId,
      accountId: authentication.accountId,
      at,
    })
    if (guard instanceof Error) throw new SystemProposalHistoryUnavailableError()
    // 最初の照会は案件の識別だけに使い、状態の固定後に開示内容を読み直す。
    const proposal = await reader.findByNumber(parameters.number, parameters.version)
    if (proposal instanceof Error || proposal === null || proposal.caseId !== located.caseId)
      throw new SystemProposalHistoryUnavailableError()
    const attestations = await reader.listAttestations(proposal.caseId)
    const tasks = await reader.listTasks(proposal.caseId)
    if (attestations instanceof Error || tasks instanceof Error)
      throw new SystemProposalHistoryUnavailableError()
    const allowed = canReadSystemProposalHistory({
      permissionKeys: authorization.permissionKeys,
      accountId: authentication.accountId,
      createdByAccountId: proposal.createdByAccountId,
      attestations,
    })
    const now = context.var.now()
    const assertions = authorization.assertions(now)
    if (assertions instanceof Error) throw new SystemProposalHistoryUnavailableError()
    const record = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemProposalHistoryRead,
      targetType: "system:proposal",
      targetId: proposal.proposalId,
      outcome: allowed ? "succeeded" : "denied",
      reasonCode: allowed ? null : "not_participant",
      authorizationJson: JSON.stringify({
        required_permission_keys: [
          SystemFeaturePermission.PROCEDURE_READ.key,
          ...(authorization.permissionKeys.has(SystemFeaturePermission.PROCEDURE_READ_ALL.key)
            ? [SystemFeaturePermission.PROCEDURE_READ_ALL.key]
            : []),
        ],
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        number: proposal.number,
        version: proposal.version,
        digest: proposal.digest,
      }),
      occurredAt: now,
    })
    if (record instanceof Error) throw new SystemProposalHistoryUnavailableError()
    const verified = await ProposalEntity.restore({
      id: proposal.proposalId,
      seriesId: proposal.seriesId,
      version: proposal.version,
      procedureKey: proposal.procedureKey,
      procedureRevision: proposal.procedureRevision,
      bodyJson: proposal.bodyJson,
      digest: proposal.digest,
      createdByAccountId: proposal.createdByAccountId,
      supersedesProposalId: proposal.supersedesProposalId,
      createdAt: proposal.createdAt,
    })
    if (verified instanceof Error) throw new SystemProposalHistoryUnavailableError()
    const audit = await new SystemAuditEventRepository(context).append(
      record,
      [...assertions, guard(now)],
      [...assertions, guard(now)],
    )
    if (audit instanceof Error) throw new SystemProposalHistoryUnavailableError()
    if (!allowed) throw new SystemForbiddenError()
    return context.json(
      {
        number: proposal.number,
        proposal_id: verified.id,
        series_id: verified.seriesId,
        version: verified.version,
        supersedes_proposal_id: verified.supersedesProposalId,
        procedure_key: verified.procedureKey,
        procedure_revision: verified.procedureRevision,
        procedure_definition: {
          key: verified.procedureKey,
          revision: verified.procedureRevision,
          title: proposal.title,
          category: proposal.category,
          description: proposal.description,
          input_schema_json: proposal.inputSchemaJson,
          decision_policy_json: proposal.decisionPolicyJson,
          completion_operation_key: proposal.completionOperationKey,
        },
        body_json: verified.bodyJson,
        digest: verified.digest,
        created_by_account_id: verified.createdByAccountId,
        created_at: verified.createdAt.toISOString(),
        case: {
          id: proposal.caseId,
          status: proposal.status,
          updated_at: proposal.updatedAt.toISOString(),
        },
        tasks,
        attestations,
      },
      200,
    )
  },
)
