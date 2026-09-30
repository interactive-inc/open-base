import type { AttachmentErasureScope } from "@system/domain/schemas/attachments/attachment-erasure-request.schema"

/** 破棄範囲を今の保存状態で解決した結果。保全中の添付は破棄対象へ入れない。 */
export type AttachmentErasureTargets = Readonly<{
  erasable: ReadonlyArray<string>
  preserved: ReadonlyArray<string>
  erased: ReadonlyArray<string>
}>

/**
 * 添付のDEKを破棄する口。破棄は包んだDEKを消すことで、原本・複製・全バックアップ世代の暗号文を
 * 同時に復号不能にする。実装は承認済み案件の一回限り実行許可と同じtransactionでだけ呼ぶ。
 */
export type AttachmentKeyDestructionPort<Effect> = Readonly<{
  findTargets(scope: AttachmentErasureScope, at: Date): Promise<AttachmentErasureTargets | Error>
  prepareDestroy(
    input: Readonly<{ attachmentIds: ReadonlyArray<string>; erasedAt: Date }>,
  ): ReadonlyArray<Effect> | Error
}>
