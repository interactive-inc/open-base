import { createClient } from "@/lib/api/hc-client"
import type { UnreadCountResponse } from "@/lib/api/types/notification-types"

/** GET /system/notifications/unread-count。自分宛ての未読通知件数を取得する。 */
export async function getMyUnreadCount(): Promise<UnreadCountResponse | Error> {
  const client = await createClient()

  const response = await client.system.notifications["unread-count"].$get()

  if (response.status !== 200) {
    return new Error("failed to load unread count")
  }

  const body = await response.json()

  return { count: body.unread_count }
}
