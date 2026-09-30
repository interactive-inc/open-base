import { StoreEncryptedAttachmentAdapter } from "@system/infrastructure/adapters/attachments/store-encrypted-attachment.adapter"
import {
  RECORD_BINARY_CONTENT_TYPE,
  RECORD_CONTENT_MAX_SIZE,
} from "@system/domain/catalogs/records/record-payload-format.catalog"
import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PreservedRecordPayloadValue } from "@system/domain/values/records/preserved-record-payload.value"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

type Command = Readonly<{
  source: unknown
  content: AttachmentBytes
  ownerAccountId: string
  now: Date
}>

/** 原記録と取得情報を可逆な形式で暗号化し、保全確定前の未紐付け本文を準備する。 */
export class StorePreservedRecordContent {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: Command) {
    const source = PreservedRecordSourceValue.create(command.source)
    if (source instanceof Error) return source
    if (
      !Number.isSafeInteger(command.now.getTime()) ||
      Date.parse(source.props.capturedAt) > command.now.getTime() ||
      command.content.byteLength > RECORD_CONTENT_MAX_SIZE
    )
      return new Error("invalid record capture time or payload size")
    const record = await PreservedRecordPayloadValue.create(source, command.content)
    if (record instanceof Error) return record
    const payload = record.toBinary()
    if (payload instanceof Error) return payload
    const attachment = await new StoreEncryptedAttachmentAdapter(this.c).run({
      ownerAccountId: command.ownerAccountId,
      fileName: "preserved-record.bin",
      contentType: RECORD_BINARY_CONTENT_TYPE,
      content: payload,
      now: command.now,
    })
    if (attachment instanceof Error) return attachment
    return { source, attachment }
  }
}
