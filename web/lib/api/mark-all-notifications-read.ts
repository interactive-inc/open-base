import { createClient } from "@/lib/api/hc-client"
import type { MarkAllReadResponse } from "@/lib/api/types/notification-types"

/** PATCH /system/notifications。自分宛ての未読通知をすべて既読にする。 */
export async function markAllNotificationsRead(): Promise<MarkAllReadResponse | Error> {
  const client = await createClient()

  const response = await client.system.notifications.$patch({ json: { read: true } })

  if (response.status !== 200) {
    return new Error("failed to mark all notifications as read")
  }

  const body = await response.json()

  return { updated: body.marked_count }
}
