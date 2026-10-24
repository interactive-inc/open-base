import { PrepareRecordRetirementSourceAttachmentsAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-source-attachments.adapter"

/** 検査した原添付が同じ停止世代で保護されていることを検査する。ストレージ本体の再取得は行わない。 */
export function prepareSystemRecordRetirementSourceAttachments(
  context: ConstructorParameters<typeof PrepareRecordRetirementSourceAttachmentsAdapter>[0],
  ...input: Parameters<PrepareRecordRetirementSourceAttachmentsAdapter["prepare"]>
): ReturnType<PrepareRecordRetirementSourceAttachmentsAdapter["prepare"]> {
  return new PrepareRecordRetirementSourceAttachmentsAdapter(context).prepare(...input)
}
