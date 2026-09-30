/** /attachments */
import { StoreAttachment } from "@system/application/attachments/store-attachment"
import { SystemAttachmentError } from "@system/domain/errors"
import {
  SystemAttachmentFileRequiredError,
  SystemAttachmentInternalError,
  SystemAttachmentUnavailableError,
  SystemAttachmentValidationError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization authenticated - ログインしていれば自分の添付を預けられる。業務レコードへの紐づけは各業務contextが認可する
/** POST /attachments — 添付を暗号化して預け、pending の attachment_id を返す */
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const form = await context.req.parseBody()

  const file = form.file

  if (!(file instanceof File)) {
    throw new SystemAttachmentFileRequiredError()
  }

  const stored = await new StoreAttachment(context).run({
    ownerAccountId: context.var.userId,
    fileName: file.name,
    contentType: file.type,
    content: new Uint8Array(await file.arrayBuffer()),
    now: context.var.now(),
  })

  if (stored instanceof SystemAttachmentError) {
    if (stored.kind === "unavailable") {
      throw new SystemAttachmentUnavailableError({
        code: stored.code,
        detail: stored.message,
        cause: stored,
      })
    }

    if (stored.kind === "unexpected") {
      throw new SystemAttachmentInternalError({
        code: stored.code,
        detail: stored.message,
        cause: stored,
      })
    }

    throw new SystemAttachmentValidationError({
      code: stored.code,
      detail: stored.message,
      payloadTooLarge: stored.kind === "payload_too_large",
      cause: stored,
    })
  }

  if (stored instanceof Error) {
    throw new SystemAttachmentInternalError({
      code: "attachment_store_failed",
      detail: "attachment store failed",
      cause: stored,
    })
  }

  return context.json(
    {
      id: stored.id,
      file_name: stored.fileName,
      content_type: stored.contentType,
      byte_size: stored.byteSize,
      sha256: stored.plaintextSha256,
      status: "pending",
      created_at: stored.createdAt.toISOString(),
    },
    201,
  )
})
