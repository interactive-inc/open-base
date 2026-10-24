import { PrepareAttachmentContentReadGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-content-read-guard.adapter"

/** 復号した内容・鍵・メタデータと紐付け状態を、開示監査のtransactionへ固定する文を返す。 */
export function prepareSystemAttachmentContentReadGuard(
  context: ConstructorParameters<typeof PrepareAttachmentContentReadGuardAdapter>[0],
  ...input: Parameters<PrepareAttachmentContentReadGuardAdapter["prepare"]>
): ReturnType<PrepareAttachmentContentReadGuardAdapter["prepare"]> {
  return new PrepareAttachmentContentReadGuardAdapter(context).prepare(...input)
}
