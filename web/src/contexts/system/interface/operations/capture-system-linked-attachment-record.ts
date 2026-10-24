import { CaptureLinkedAttachmentRecordAdapter } from "@system/infrastructure/adapters/records/capture-linked-attachment-record.adapter"

/** 所有業務の参照資格・関連行の検査を受け取り、添付メタデータと本体を保全候補へ固定する。 */
export function captureSystemLinkedAttachmentRecord(
  context: ConstructorParameters<typeof CaptureLinkedAttachmentRecordAdapter>[0],
  ...input: Parameters<CaptureLinkedAttachmentRecordAdapter["prepare"]>
): ReturnType<CaptureLinkedAttachmentRecordAdapter["prepare"]> {
  return new CaptureLinkedAttachmentRecordAdapter(context).prepare(...input)
}
