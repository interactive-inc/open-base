import type { SystemD1Context } from "@system/configuration/system-context"
import { createExecutionAuthorizationId } from "@system/domain/schemas/workflow/execution-authorization-id.schema"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import {
  ATTACHMENT_ERASURE_OPERATION_KEY,
  AttachmentErasureRequestValue,
} from "@system/domain/values/attachments/attachment-erasure-request.value"
import { AttachmentErasureError } from "@system/application/attachments/errors"
import { AttachmentKeyDestructionAdapter } from "@system/infrastructure/adapters/attachments/attachment-key-destruction.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context

export type AttachmentErasureExecution = Readonly<{
  kind: "destroyed" | "replayed"
  requestId: string
  attachmentIds: ReadonlyArray<string>
}>

/**
 * 承認済みの消去案件だけを、一回限りの実行許可を消費して実行する。
 * DEKの破棄、案件の実行済み化、破棄の監査を一つのD1 batchで確定し、どれかが失敗すれば何も残さない。
 * 承認を経ない破棄の経路は持たない。
 */
export class ExecuteAttachmentErasureAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    input: Readonly<{
      authentication: SystemReadAuthentication
      proposal: SystemProposalView
      executionGuards: ReadonlyArray<D1PreparedStatement>
      at: Date
    }>,
  ): Promise<AttachmentErasureExecution | AttachmentErasureError> {
    try {
      return await this.run(input)
    } catch (cause) {
      return new AttachmentErasureError("unavailable", { cause })
    }
  }

  private async run(
    input: Parameters<ExecuteAttachmentErasureAdapter["execute"]>[0],
  ): Promise<AttachmentErasureExecution | AttachmentErasureError> {
    const { authentication, proposal, at } = input
    if (!Number.isSafeInteger(at.getTime())) return new AttachmentErasureError("invalid")
    if (proposal.completionOperationKey !== ATTACHMENT_ERASURE_OPERATION_KEY)
      return new AttachmentErasureError("not_found")
    if (authentication.machineCredentialId !== null) return new AttachmentErasureError("forbidden")
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      authentication,
      at,
    )
    if (proof instanceof Error) return new AttachmentErasureError("unavailable", { cause: proof })
    if (
      proof === null ||
      !(
        proof.permissionKeys.has(SystemFeaturePermission.PERSONAL_DATA_ERASE.key) ||
        proof.permissionKeys.has("system:admin")
      )
    )
      return new AttachmentErasureError("forbidden")
    let body: unknown
    try {
      body = JSON.parse(proposal.bodyJson)
    } catch (cause) {
      return new AttachmentErasureError("unavailable", { cause })
    }
    const request = AttachmentErasureRequestValue.restore(body)
    if (request instanceof Error)
      return new AttachmentErasureError("unavailable", { cause: request })
    const destruction = new AttachmentKeyDestructionAdapter(this.c)
    if (proposal.status === "executed") {
      const recorded = await destruction.findDestructionAudit(request.body.requestId)
      if (recorded instanceof Error)
        return new AttachmentErasureError("unavailable", { cause: recorded })
      return recorded === null
        ? new AttachmentErasureError("conflict")
        : {
            kind: "replayed",
            requestId: request.body.requestId,
            attachmentIds: request.body.targetAttachmentIds,
          }
    }
    if (proposal.status !== "approved") return new AttachmentErasureError("not_approved")
    const technical = proof.assertions(at)
    if (technical instanceof Error) return new AttachmentErasureError("forbidden")
    const destroy = destruction.prepareDestroy({
      attachmentIds: request.body.targetAttachmentIds,
      erasedAt: at,
    })
    if (destroy instanceof Error) return new AttachmentErasureError("invalid", { cause: destroy })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: authentication.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemAttachmentKeyDestroyed,
      targetType: "system:attachment-erasure",
      targetId: request.body.requestId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        caseId: proposal.caseId,
        number: proposal.number,
        proposalDigest: proposal.digest,
      }),
      beforeJson: null,
      afterJson: JSON.stringify({
        requestId: request.body.requestId,
        scope: request.body.scope,
        attachmentIds: request.body.targetAttachmentIds,
        erasedAt: at.toISOString(),
      }),
      metadataJson: null,
      occurredAt: at,
    })
    if (audit instanceof Error) return new AttachmentErasureError("invalid", { cause: audit })
    const authorization = ExecutionAuthorizationEntity.create({
      id: await createExecutionAuthorizationId("attachment-erasure", proposal.caseId),
      caseId: proposal.caseId,
      operationKey: ATTACHMENT_ERASURE_OPERATION_KEY,
      proposalDigest: proposal.digest,
      grantedToAccountId: authentication.accountId,
      grantedAt: at,
      expiresAt: new Date(at.getTime() + 60_000),
      usedAt: null,
    })
    if (authorization instanceof Error)
      return new AttachmentErasureError("unavailable", { cause: authorization })
    const executed = await new SystemD1AuthorizedExecutionAdapter(this.c).execute({
      authorization,
      proposalDigest: authorization.proposalDigest,
      executedAt: at,
      operationStatements: [
        ...technical,
        ...input.executionGuards,
        ...destroy,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ],
    })
    if (executed instanceof Error) {
      return /attachment_preserved/.test(errorChainText(executed))
        ? new AttachmentErasureError("preserved", { cause: executed })
        : new AttachmentErasureError("conflict", { cause: executed })
    }
    return {
      kind: "destroyed",
      requestId: request.body.requestId,
      attachmentIds: request.body.targetAttachmentIds,
    }
  }
}

function errorChainText(error: Error): string {
  const messages: string[] = []
  const visited = new Set<unknown>()
  for (let current: unknown = error; current instanceof Error && !visited.has(current); ) {
    visited.add(current)
    messages.push(current.message)
    current = current.cause
  }
  return messages.join("\n")
}
