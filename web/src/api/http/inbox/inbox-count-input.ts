import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"

/** 各業務の未処理件数の取得へ渡す、操作者と判断資格。 */
export type InboxCountInput = Readonly<{
  session: CompanyPersonnelSession
  tokenVersion: number
  canApproveLeaves: boolean
  canApproveShiftSwaps: boolean
  canApproveThanksRedemptions: boolean
}>

/** 製品inboxの業務別の件数。業務contextが無い構成では、その業務の件数は0のままになる。 */
export type InboxBusinessCounts = {
  expenses: number
  expenses_has_more: boolean
  leaves: number
  leaves_has_more: boolean
  shifts: number
  thanks: number
}

export const EMPTY_INBOX_BUSINESS_COUNTS: Readonly<InboxBusinessCounts> = Object.freeze({
  expenses: 0,
  expenses_has_more: false,
  leaves: 0,
  leaves_has_more: false,
  shifts: 0,
  thanks: 0,
})
