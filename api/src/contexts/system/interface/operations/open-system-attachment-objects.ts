import { AttachmentObjectAdapter } from "@system/infrastructure/adapters/attachments/attachment-object.adapter"

/** 暗号化済みの添付本体を置く保存先を開く。 */
export function openSystemAttachmentObjects(
  context: ConstructorParameters<typeof AttachmentObjectAdapter>[0],
): AttachmentObjectAdapter {
  return new AttachmentObjectAdapter(context)
}
