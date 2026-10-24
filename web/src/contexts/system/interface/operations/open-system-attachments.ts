import { AttachmentAdapter } from "@system/infrastructure/adapters/attachments/attachment.adapter"

/** 添付メタデータの保存口を開く。本体の所在と復号鍵はここだけが持つ。 */
export function openSystemAttachments(
  context: ConstructorParameters<typeof AttachmentAdapter>[0],
): AttachmentAdapter {
  return new AttachmentAdapter(context)
}
