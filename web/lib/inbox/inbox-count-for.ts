import type { InboxCounts } from "@/lib/api/types/inbox-types"
import type { InboxType } from "@/lib/inbox/visible-inbox-types"

/** 種類の未処理件数を InboxCounts から引く。countKey を持たない種類は null。 */
export function inboxCountFor(inboxType: InboxType, counts: InboxCounts): number | null {
  if (inboxType.countKey === undefined) return null

  return counts[inboxType.countKey]
}
