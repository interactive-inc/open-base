import { PrepareAttachmentErasureDecisionAuditAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-erasure-decision-audit.adapter"

/** 消去申請への人の判断を、判断を保存するtransactionへ追記する監査文にする。 */
export function prepareSystemAttachmentErasureDecisionAudit(
  context: ConstructorParameters<typeof PrepareAttachmentErasureDecisionAuditAdapter>[0],
  ...input: Parameters<PrepareAttachmentErasureDecisionAuditAdapter["prepare"]>
): ReturnType<PrepareAttachmentErasureDecisionAuditAdapter["prepare"]> {
  return new PrepareAttachmentErasureDecisionAuditAdapter(context).prepare(...input)
}
