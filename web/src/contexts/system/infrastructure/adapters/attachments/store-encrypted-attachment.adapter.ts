import {
  RECORD_BINARY_CONTENT_TYPE,
  RECORD_BINARY_MAX_SIZE,
} from "@system/domain/catalogs/records/record-payload-format.catalog"
import { encryptAttachment } from "@system/application/attachments/lib/encrypt-attachment"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"
import {
  ATTACHMENT_MAX_BYTE_SIZE,
  ATTACHMENT_MAX_FILE_NAME_LENGTH,
} from "@system/domain/catalogs/attachments/attachment-content.catalog"
import type {
  AttachmentStorageCommand,
  StoredAttachment,
} from "@system/domain/definitions/attachments/attachment-storage.definition"
import type {
  SystemAttachmentStorageContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

type Context = SystemDatabaseContext & SystemAttachmentStorageContext

/** 内容種別を所有側で検査したデータを、予約行・暗号文・未紐付け状態の順で保存する。 */
export class StoreEncryptedAttachmentAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async run(command: AttachmentStorageCommand): Promise<StoredAttachment | Error> {
    if (
      command.content.byteLength <= 0 ||
      command.content.byteLength >
        (command.contentType === RECORD_BINARY_CONTENT_TYPE
          ? RECORD_BINARY_MAX_SIZE
          : ATTACHMENT_MAX_BYTE_SIZE) ||
      command.fileName.trim().length === 0 ||
      command.fileName.trim().length > ATTACHMENT_MAX_FILE_NAME_LENGTH ||
      command.ownerAccountId.trim().length === 0 ||
      command.contentType.trim().length === 0 ||
      !Number.isSafeInteger(command.now.getTime())
    )
      return new Error("invalid encrypted attachment storage command")
    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)

    if (registry instanceof Error) return registry

    const encrypted = await encryptAttachment(command.content, registry.current())

    const id = crypto.randomUUID()

    const objectKey = `att/${id}`

    const repository = new AttachmentAdapter(this.c)

    const reserved = await repository.reserve({
      id,
      ownerAccountId: command.ownerAccountId,
      objectKey,
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      fileName: command.fileName.trim(),
      plaintextSha256: encrypted.plaintextSha256,
      wrappedDek: encrypted.wrappedDek,
      wrappedDekIv: encrypted.wrappedDekIv,
      contentIv: encrypted.contentIv,
      kekVersion: encrypted.kekVersion,
      createdAt: command.now,
    })

    if (reserved instanceof Error) return reserved

    const stored = await new AttachmentObjectAdapter(this.c).put(objectKey, encrypted.ciphertext)

    if (stored instanceof Error) return stored

    const pending = await repository.markPending(id)

    if (pending instanceof Error) return pending

    return {
      id,
      fileName: command.fileName.trim(),
      contentType: command.contentType,
      byteSize: command.content.byteLength,
      plaintextSha256: encrypted.plaintextSha256,
      createdAt: command.now,
    }
  }
}
