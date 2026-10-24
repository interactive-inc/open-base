/**
 * 添付の状態。uploading は本体書き込み前の予約行で、掃除バッチが回収する。
 * pending は本人だけが業務レコードへ紐づけられる。linked は業務レコードから参照されている。
 * erased は鍵破棄済みで、本体を復号できない。
 */
export const ATTACHMENT_STATUSES = ["uploading", "pending", "linked", "erased"] as const

export type AttachmentStatus = (typeof ATTACHMENT_STATUSES)[number]

export function isAttachmentStatus(value: string): value is AttachmentStatus {
  return ATTACHMENT_STATUSES.some((status) => status === value)
}
