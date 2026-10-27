import { PrepareAttachmentEvidenceAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-evidence.adapter"

/** 添付の所有者・内容・状態を固定し、業務と同時に紐付ける文を用意する。 */
export function prepareSystemAttachmentEvidence(
  context: ConstructorParameters<typeof PrepareAttachmentEvidenceAdapter>[0],
  ...input: Parameters<PrepareAttachmentEvidenceAdapter["prepare"]>
): ReturnType<PrepareAttachmentEvidenceAdapter["prepare"]> {
  return new PrepareAttachmentEvidenceAdapter(context).prepare(...input)
}
