import { RECORD_BINARY_CONTENT_TYPE } from "@system/domain/catalogs/records/record-payload-format.catalog"
import { VerifyAttachmentContentAdapter } from "@system/infrastructure/adapters/attachments/verify-attachment-content.adapter"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

/** 暗号化された保全本文を読み戻し、原記録と取得情報の一致を検証する。 */
export class VerifyPreservedRecordContentAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(record: PreservedRecordEntity, expectedStatus: "pending" | "linked") {
    const attachment = await new AttachmentAdapter(this.c).findById(record.snapshot.attachmentId)
    if (attachment instanceof Error) return attachment
    if (
      !attachment ||
      attachment.status !== expectedStatus ||
      attachment.ownerAccountId !== record.snapshot.actorAccountId ||
      (attachment.contentType !== "application/vnd.record-preservation+json" &&
        attachment.contentType !== RECORD_BINARY_CONTENT_TYPE) ||
      attachment.plaintextSha256 !== record.snapshot.attachmentDigest ||
      attachment.createdAt.getTime() > Date.parse(record.snapshot.finalizedAt) ||
      attachment.wrappedDek === null ||
      attachment.wrappedDekIv === null
    )
      return new Error("prepared record attachment is unavailable or mismatched")
    const bytes = await new VerifyAttachmentContentAdapter(this.c).execute(
      attachment,
      expectedStatus,
    )
    if (bytes instanceof Error) return bytes
    const payload = await PreservedRecordPayloadValue.restore(
      bytes,
      record.source,
      attachment.contentType === RECORD_BINARY_CONTENT_TYPE ? "binary" : "json",
    )
    if (payload instanceof Error) return payload
    return Object.freeze({ attachment, payload })
  }
}
