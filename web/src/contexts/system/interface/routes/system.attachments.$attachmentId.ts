import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { SystemAttachmentError } from "@system/domain/errors"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { PrepareAttachmentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-read-guard.adapter"
/** /attachments/:attachmentId */
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import {
  SystemAttachmentInternalError,
  SystemAttachmentNotFoundError,
  SystemAttachmentNotPendingError,
  SystemAttachmentReadError,
  SystemAttachmentUnavailableError,
  SystemInvalidSessionError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"

/**
 * 紐づけ前の添付を、預けた本人だけが取り出す。業務レコードへ紐づいた後の閲覧は
 * 各業務context側の URL が親レコードの閲覧権限で認可する（System は業務の認可規則を知らない）。
 */
// @authorization owner - アップロード本人の未紐づけ添付に限定する
export const GET = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const attachmentId = context.req.param("attachmentId") ?? ""

  if (attachmentId === "") {
    throw new SystemAttachmentNotFoundError()
  }

  const row = await new AttachmentAdapter(context).findById(attachmentId)

  if (row instanceof Error) {
    throw new SystemAttachmentUnavailableError({ cause: row })
  }

  if (row === null || row.ownerAccountId !== context.var.userId) {
    throw new SystemAttachmentNotFoundError()
  }

  if (row.status !== "pending" && row.status !== "uploading") {
    throw new SystemAttachmentNotPendingError()
  }

  const content = await (async () => {
    if (row.wrappedDek === null || row.wrappedDekIv === null) {
      return new SystemAttachmentError("not_found", "attachment_erased", "この添付は消去済みです")
    }

    const registry = AttachmentKekRegistry.fromEnv(context.env.ATTACHMENT_KEKS)

    if (registry instanceof Error) return registry

    const kek = registry.resolve(row.kekVersion)

    if (kek instanceof Error) return kek

    const ciphertext = await new AttachmentObjectAdapter(context).get(row.objectKey)

    if (ciphertext instanceof Error) return ciphertext

    const plaintext = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: row.wrappedDek,
        wrappedDekIv: row.wrappedDekIv,
        contentIv: row.contentIv,
        kekVersion: row.kekVersion,
      },
      kek,
    )

    if (plaintext instanceof Error) return plaintext

    const digest = await toSha256Hex(plaintext)

    if (digest !== row.plaintextSha256 || plaintext.byteLength !== row.byteSize) {
      return new SystemAttachmentError(
        "unprocessable",
        "attachment_integrity_mismatch",
        "添付の内容がメタデータと一致しません",
      )
    }

    return {
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
      content: plaintext,
    }
  })()

  if (content instanceof SystemAttachmentError) {
    throw new SystemAttachmentReadError({
      code: content.code,
      detail: content.message,
      unavailable: content.code === "attachment_storage_unconfigured",
      cause: content,
    })
  }

  if (content instanceof Error) {
    throw new SystemAttachmentInternalError({
      code: "attachment_read_failed",
      detail: "attachment read failed",
      cause: content,
    })
  }

  const authentication = context.var.bearerReadAuthentication
  const at = context.var.now()

  if (
    authentication === undefined ||
    authentication.accountId !== context.var.userId ||
    authentication.expiresAtMs <= Date.now()
  ) {
    throw new SystemInvalidSessionError()
  }

  const audit = SystemAuditEventEntity.create({
    actorAccountId: context.var.userId,
    action: SYSTEM_AUDIT_ACTIONS.attachmentRead,
    targetType: "attachment",
    targetId: attachmentId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: JSON.stringify({
      policy: "owner-unlinked",
      accountId: authentication.accountId,
      tokenVersion: authentication.tokenVersion,
      machineCredentialId: authentication.machineCredentialId ?? null,
    }),
    beforeJson: null,
    afterJson: null,
    metadataJson: JSON.stringify({ sha256: row.plaintextSha256, byteSize: row.byteSize }),
    occurredAt: at,
  })

  if (audit instanceof Error) {
    throw new SystemAttachmentUnavailableError({ cause: audit })
  }

  const assertions = new PrepareAttachmentReadGuardAdapter(context).prepare({
    attachment: row,
    authentication,
    at,
  })
  const savedAudit = await new SystemAuditEventRepository(context).append(audit, [], assertions)

  if (savedAudit instanceof Error) {
    const rejection = PrepareAttachmentReadGuardAdapter.rejection(savedAudit)

    if (rejection === "actor") throw new SystemInvalidSessionError()
    if (rejection === "target") throw new SystemAttachmentNotFoundError()
    throw new SystemAttachmentUnavailableError({ cause: savedAudit })
  }

  return new Response(content.content, {
    status: 200,
    headers: {
      "content-type": content.contentType,
      "content-length": String(content.byteSize),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(content.fileName)}`,
      "cache-control": "no-store",
    },
  })
})
