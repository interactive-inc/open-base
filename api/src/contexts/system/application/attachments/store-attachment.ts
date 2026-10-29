import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { StoreEncryptedAttachmentAdapter } from "@system/infrastructure/adapters/attachments/store-encrypted-attachment.adapter"
import type {
  AttachmentStorageCommand,
  StoredAttachment,
} from "@system/domain/definitions/attachments/attachment-storage.definition"
import { SystemAttachmentError } from "@system/domain/errors"
import { validateAttachmentContent } from "@system/domain/policies/attachment-content.policy"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

/**
 * 添付を暗号化して保管する。行を先に予約してから本体を書き、最後に pending へ進めるため、
 * 途中で失敗しても object storage 側に行の無い孤児が残らない。
 */
export class StoreAttachment {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private static toViolationError(violation: string): Error {
    if (violation === "byte_size_exceeded") {
      return new SystemAttachmentError(
        "payload_too_large",
        "attachment_byte_size_exceeded",
        "添付が上限サイズを超えています",
      )
    }

    return new SystemAttachmentError(
      "validation",
      `attachment_${violation}`,
      "添付を受け付けられません",
    )
  }

  /** HTTP uploadでは検証済みproofを必ず渡す。省略はサーバー内部の本文準備に限る。 */
  async run(
    command: AttachmentStorageCommand,
    authentication: SystemReadAuthentication | null = null,
  ): Promise<StoredAttachment | Error> {
    if (authentication !== null && authentication.accountId !== command.ownerAccountId)
      return new SystemAttachmentError(
        "validation",
        "attachment_upload_actor_changed",
        "attachment upload authentication changed",
      )
    const violation = validateAttachmentContent({
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      fileName: command.fileName,
    })

    if (violation !== null) return StoreAttachment.toViolationError(violation)

    return new StoreEncryptedAttachmentAdapter(this.c).run(command, authentication)
  }
}
