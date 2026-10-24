import {
  EMPTY_INBOX_BUSINESS_COUNTS,
  type InboxBusinessCounts,
  type InboxCountInput,
} from "@/api/http/inbox/inbox-count-input"
import type { Context } from "@/env"
import { ApplicationError } from "@/lib/errors"

/**
 * 各業務contextの未処理件数を権限に応じて製品inboxへ合成する。
 * 業務contextが無い構成では、その業務の件数を0として同じ形の応答を返す。
 */
export async function readInboxBusinessCounts(
  _context: Context,
  _input: InboxCountInput,
): Promise<InboxBusinessCounts | ApplicationError> {
  const results = [] as (Partial<InboxBusinessCounts> | ApplicationError)[]
  const counts: InboxBusinessCounts = { ...EMPTY_INBOX_BUSINESS_COUNTS }
  for (const result of results) {
    if (result instanceof ApplicationError) return result
    Object.assign(counts, result)
  }
  return counts
}
