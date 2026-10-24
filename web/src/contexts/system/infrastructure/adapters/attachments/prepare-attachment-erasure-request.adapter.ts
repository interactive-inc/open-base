import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemFeaturePermission } from "@system/domain/catalogs/iam/system-feature-permission.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import {
  attachmentErasureScopeSchema,
  type AttachmentErasureRequestBody,
} from "@system/domain/schemas/attachments/attachment-erasure-request.schema"
import { AttachmentErasureRequestValue } from "@system/domain/values/attachments/attachment-erasure-request.value"
import { AttachmentErasureError } from "@system/application/attachments/errors"
import { AttachmentKeyDestructionAdapter } from "@system/infrastructure/adapters/attachments/attachment-key-destruction.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { z } from "zod"

type Context = SystemD1Context

export type PreparedAttachmentErasureRequest = Readonly<{
  body: AttachmentErasureRequestBody
  /** 申請IDを提案seriesにした汎用の提案案件。承認対象は提案本文のdigestで固定される。 */
  seriesId: string
  subject: Readonly<{ context: "system"; kind: "proposal"; id: string; version: "1" }>
  startGuards: ReadonlyArray<D1PreparedStatement>
}>

/**
 * 消去申請の本文と、案件の作成と同じtransactionで確かめる検査・申請監査を用意する。
 * 申請には人の `personal_data:erase` か `system:admin` を要求する。
 */
export class PrepareAttachmentErasureRequestAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      authentication: SystemReadAuthentication
      requestId: string
      scope: unknown
      reason: string
      at: Date
    }>,
  ): Promise<PreparedAttachmentErasureRequest | AttachmentErasureError> {
    try {
      return await this.prepareRequest(input)
    } catch (cause) {
      return new AttachmentErasureError("unavailable", { cause })
    }
  }

  private async prepareRequest(
    input: Parameters<PrepareAttachmentErasureRequestAdapter["prepare"]>[0],
  ): Promise<PreparedAttachmentErasureRequest | AttachmentErasureError> {
    const scope = attachmentErasureScopeSchema.safeParse(input.scope)
    if (
      !scope.success ||
      !z.uuid().safeParse(input.requestId).success ||
      !Number.isSafeInteger(input.at.getTime())
    )
      return new AttachmentErasureError("invalid")
    if (input.authentication.machineCredentialId !== null)
      return new AttachmentErasureError("forbidden")
    const proof = await new PrepareSystemReadAuthorizationAdapter(this.c).prepare(
      input.authentication,
      input.at,
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
    const destruction = new AttachmentKeyDestructionAdapter(this.c)
    const targets = await destruction.findTargets(scope.data, input.at)
    if (targets instanceof Error)
      return new AttachmentErasureError("unavailable", { cause: targets })
    if (targets.erasable.length === 0) {
      if (targets.preserved.length > 0) return new AttachmentErasureError("preserved")
      if (targets.erased.length > 0) return new AttachmentErasureError("already_erased")
      return new AttachmentErasureError("not_found")
    }
    const duplicate = await destruction.hasOpenErasure(targets.erasable)
    if (duplicate instanceof Error)
      return new AttachmentErasureError("unavailable", { cause: duplicate })
    if (duplicate) return new AttachmentErasureError("duplicate")
    const request = AttachmentErasureRequestValue.create({
      requestId: input.requestId,
      scope: scope.data,
      reason: input.reason,
      requestedByAccountId: input.authentication.accountId,
      requestedAt: input.at.toISOString(),
      targetAttachmentIds: targets.erasable,
      preservedAttachmentIds: targets.preserved,
    })
    if (request instanceof Error) return new AttachmentErasureError("invalid", { cause: request })
    const audit = SystemAuditEventEntity.create({
      actorAccountId: input.authentication.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemAttachmentErasureRequested,
      targetType: "system:attachment-erasure",
      targetId: request.body.requestId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: JSON.stringify(request.body),
      metadataJson: null,
      occurredAt: input.at,
    })
    if (audit instanceof Error) return new AttachmentErasureError("invalid", { cause: audit })
    const assertions = proof.assertions(input.at)
    if (assertions instanceof Error) return new AttachmentErasureError("forbidden")
    return {
      body: request.body,
      seriesId: request.body.requestId,
      subject: { context: "system", kind: "proposal", id: request.body.requestId, version: "1" },
      startGuards: [
        ...assertions,
        destruction.prepareNoOpenErasure(request.body.targetAttachmentIds),
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ],
    }
  }
}
