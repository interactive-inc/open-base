import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import {
  ATTACHMENT_ERASURE_OPERATION_KEY,
  AttachmentErasureRequestValue,
} from "@system/domain/values/attachments/attachment-erasure-request.value"
import { AttachmentErasureError } from "@system/application/attachments/errors"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context

/** 消去申請への人の判断を、判断を保存するtransactionへ追記する監査文にする。 */
export class PrepareAttachmentErasureDecisionAuditAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    input: Readonly<{
      proposal: SystemProposalView
      actorAccountId: string
      representedAccountId: string
      action: "approve" | "reject" | "return"
      taskKey: string
      round: number
      decidedAt: Date
    }>,
  ): ReadonlyArray<D1PreparedStatement> | AttachmentErasureError {
    if (input.proposal.completionOperationKey !== ATTACHMENT_ERASURE_OPERATION_KEY)
      return new AttachmentErasureError("invalid")
    let body: unknown
    try {
      body = JSON.parse(input.proposal.bodyJson)
    } catch (cause) {
      return new AttachmentErasureError("unavailable", { cause })
    }
    const request = AttachmentErasureRequestValue.restore(body)
    if (request instanceof Error)
      return new AttachmentErasureError("unavailable", { cause: request })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: input.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemAttachmentErasureDecided,
      targetType: "system:attachment-erasure",
      targetId: request.body.requestId,
      outcome: "succeeded",
      reasonCode: input.action,
      authorizationJson: JSON.stringify({ representedAccountId: input.representedAccountId }),
      beforeJson: null,
      afterJson: JSON.stringify({
        caseId: input.proposal.caseId,
        number: input.proposal.number,
        proposalDigest: input.proposal.digest,
        taskKey: input.taskKey,
        round: input.round,
        action: input.action,
      }),
      metadataJson: null,
      occurredAt: input.decidedAt,
    })
    if (audit instanceof Error) return new AttachmentErasureError("invalid", { cause: audit })
    return new SystemAuditEventRepository(this.c).prepareAppend(audit)
  }
}
