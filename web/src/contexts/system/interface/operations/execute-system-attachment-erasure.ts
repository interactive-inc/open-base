import { ExecuteAttachmentErasureAdapter } from "@system/infrastructure/adapters/attachments/execute-attachment-erasure.adapter"

/** 承認済みの消去案件だけを一回限りの実行許可で実行し、DEKの破棄・案件の実行済み化・破棄の監査を同時に確定する。承認を経ない破棄の経路は無い。 */
export function executeSystemAttachmentErasure(
  context: ConstructorParameters<typeof ExecuteAttachmentErasureAdapter>[0],
  ...input: Parameters<ExecuteAttachmentErasureAdapter["execute"]>
): ReturnType<ExecuteAttachmentErasureAdapter["execute"]> {
  return new ExecuteAttachmentErasureAdapter(context).execute(...input)
}
