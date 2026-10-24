import type { InboxCounts } from "@/lib/api/types/inbox-types"
import { visibleInboxTypes } from "@/lib/inbox/visible-inbox-types"
import { inboxCountFor } from "@/lib/inbox/inbox-count-for"

/** 表示できる受信箱だけを合計し、省略された件数の有無も同じ範囲で返す。 */
export function toVisibleInboxSummary(
  counts: InboxCounts,
  permissions: ReadonlyArray<string>,
  disabledFeatures: ReadonlyArray<string>,
) {
  const visible = visibleInboxTypes(permissions, disabledFeatures)
  return {
    total: visible.reduce((total, inbox) => total + (inboxCountFor(inbox, counts) ?? 0), 0),
    hasMore:
      counts.expenses_has_more === true && visible.some((inbox) => inbox.countKey === "expenses"),
  }
}
