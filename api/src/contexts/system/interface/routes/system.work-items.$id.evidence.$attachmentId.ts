import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { SystemWorkItemError } from "@system/domain/errors"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { SystemWorkEvidenceGuardAdapter } from "@system/infrastructure/adapters/work/system-work-evidence-guard.adapter"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

// @authorization service - 現在の参加資格・証拠の完全性・開示監査を確認して添付を渡す
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid(), attachmentId: z.string().min(1).max(64) })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:read",
      requiresStepUp: false,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const parameters = context.req.valid("param")
    const workItem = await prepared.repository.findCurrent(parameters.id)
    if (workItem instanceof Error) throw new SystemWorkItemHttpError(workItem)
    if (workItem === null) throw new SystemWorkItemHttpError(new SystemWorkItemError("not_found"))
    const attachment = await new AttachmentAdapter(context).findById(parameters.attachmentId)
    if (attachment instanceof Error)
      throw new SystemWorkItemHttpError(new SystemWorkItemError("unavailable", attachment))
    if (
      attachment === null ||
      attachment.status !== "linked" ||
      attachment.wrappedDek === null ||
      attachment.wrappedDekIv === null
    )
      throw new SystemWorkItemHttpError(new SystemWorkItemError("not_found"))
    const workGuard = prepared.repository.prepareReadAssertion(workItem.snapshot.commandId)
    const evidence = new SystemWorkEvidenceGuardAdapter(context)
    const evidenceGuard = evidence.prepare({
      workItemId: parameters.id,
      attachment,
      now: context.var.now(),
    })
    const initial = prepared.authorization.assertions()
    if (initial instanceof Error) throw new SystemWorkItemHttpError(initial)
    const verified = await evidence.verify([...initial, workGuard, evidenceGuard])
    if (verified instanceof Error) throw new SystemWorkItemHttpError(verified)
    const registry = AttachmentKekRegistry.fromEnv(context.env.ATTACHMENT_KEKS)
    if (registry instanceof Error)
      throw new SystemWorkItemHttpError(new SystemWorkItemError("unavailable", registry))
    const kek = registry.resolve(attachment.kekVersion)
    if (kek instanceof Error)
      throw new SystemWorkItemHttpError(new SystemWorkItemError("unavailable", kek))
    const ciphertext = await new AttachmentObjectAdapter(context).get(attachment.objectKey)
    if (ciphertext instanceof Error)
      throw new SystemWorkItemHttpError(new SystemWorkItemError("unavailable", ciphertext))
    const plaintext = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: attachment.wrappedDek,
        wrappedDekIv: attachment.wrappedDekIv,
        contentIv: attachment.contentIv,
        kekVersion: attachment.kekVersion,
      },
      kek,
    )
    if (
      plaintext instanceof Error ||
      plaintext.byteLength !== attachment.byteSize ||
      (await toSha256Hex(plaintext)) !== attachment.plaintextSha256
    )
      throw new SystemWorkItemHttpError(
        new SystemWorkItemError("unavailable", plaintext instanceof Error ? plaintext : undefined),
      )
    const assertions = prepared.authorization.assertions()
    if (assertions instanceof Error) throw new SystemWorkItemHttpError(assertions)
    const audit = SystemAuditEventEntity.create({
      actorAccountId: prepared.authorization.actor.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemWorkEvidenceRead,
      targetType: "system:work-item",
      targetId: parameters.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        actor: prepared.authorization.actor,
        authentication: prepared.authorization.authentication,
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        attachmentId: attachment.id,
        sha256: attachment.plaintextSha256,
        byteSize: attachment.byteSize,
        revision: workItem.snapshot.revision,
      }),
      occurredAt: context.var.now(),
    })
    if (audit instanceof Error)
      throw new SystemWorkItemHttpError(new SystemWorkItemError("unavailable", audit))
    const saved = await new SystemAuditEventRepository(context).append(
      audit,
      [...assertions, workGuard, evidenceGuard],
      [...assertions, workGuard, evidenceGuard],
    )
    if (saved instanceof Error)
      throw new SystemWorkItemHttpError(new SystemWorkItemError("unavailable", saved))
    return new Response(plaintext, {
      status: 200,
      headers: {
        "content-type": attachment.contentType,
        "content-length": String(attachment.byteSize),
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    })
  },
)
