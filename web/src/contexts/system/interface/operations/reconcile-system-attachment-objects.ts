import { AttachmentReconciliationAdapter } from "@system/infrastructure/adapters/attachments/attachment-reconciliation.adapter"

/** 添付本体の実在を照合し、実行と結果をSystem batch jobへ、欠損と失敗をSystem通知へ記録する。 */
export function reconcileSystemAttachmentObjects(
  context: ConstructorParameters<typeof AttachmentReconciliationAdapter>[0],
  ...input: Parameters<AttachmentReconciliationAdapter["run"]>
): ReturnType<AttachmentReconciliationAdapter["run"]> {
  return new AttachmentReconciliationAdapter(context).run(...input)
}
