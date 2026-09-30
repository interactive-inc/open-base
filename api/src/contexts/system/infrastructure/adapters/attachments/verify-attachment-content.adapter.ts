import type { SystemAttachmentStorageContext } from "@system/configuration/system-context"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"
import { AttachmentKekRegistry } from "@system/application/attachments/lib/attachment-kek-registry"
import { decryptAttachment } from "@system/application/attachments/lib/decrypt-attachment"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"

type Context = SystemAttachmentStorageContext

/** 添付実体を復号し、固定されたメタデータと照合する。呼出側が閲覧資格と保存・開示時の再検査を担う。 */
export class VerifyAttachmentContentAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(attachment: SystemAttachmentRow, expectedStatus: "pending" | "linked") {
    if (
      attachment.status !== expectedStatus ||
      attachment.erasedAt !== null ||
      attachment.wrappedDek === null ||
      attachment.wrappedDekIv === null
    )
      return new Error("attachment content is unavailable")
    const registry = AttachmentKekRegistry.fromEnv(this.c.env.ATTACHMENT_KEKS)
    if (registry instanceof Error) return registry
    const key = registry.resolve(attachment.kekVersion)
    if (key instanceof Error) return key
    const ciphertext = await new AttachmentObjectAdapter(this.c).get(attachment.objectKey)
    if (ciphertext instanceof Error) return ciphertext
    const content = await decryptAttachment(
      ciphertext,
      {
        wrappedDek: attachment.wrappedDek,
        wrappedDekIv: attachment.wrappedDekIv,
        contentIv: attachment.contentIv,
        kekVersion: attachment.kekVersion,
      },
      key,
    )
    if (content instanceof Error) return content
    if (
      content.byteLength !== attachment.byteSize ||
      (await toSha256Hex(content)) !== attachment.plaintextSha256
    )
      return new Error("attachment content digest or size does not match")
    return content
  }
}
