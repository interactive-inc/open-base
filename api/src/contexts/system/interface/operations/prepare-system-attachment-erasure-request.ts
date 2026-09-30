import { PrepareAttachmentErasureRequestAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-erasure-request.adapter"

/** 個人情報を含む添付の消去申請を検査し、承認手続の本文と、案件の作成と同じtransactionで確かめる検査・申請監査を返す。申請には人の `personal_data:erase` か `system:admin` を要求する。 */
export function prepareSystemAttachmentErasureRequest(
  context: ConstructorParameters<typeof PrepareAttachmentErasureRequestAdapter>[0],
  ...input: Parameters<PrepareAttachmentErasureRequestAdapter["prepare"]>
): ReturnType<PrepareAttachmentErasureRequestAdapter["prepare"]> {
  return new PrepareAttachmentErasureRequestAdapter(context).prepare(...input)
}
