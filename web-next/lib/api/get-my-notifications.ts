import { createClient } from "@/lib/api/hc-client"
import type { NotificationResponse } from "@/lib/api/types/notification-types"

type NotificationListResult = {
  data: Array<NotificationResponse>
  total: number
}

/**
 * GET /system/notifications。自分の System Account 宛て通知を取得する。
 * isRead を渡すと既読/未読で絞り込む（省略時はすべて）。
 */
export async function getMyNotifications(props: {
  limit: number
  offset: number
  isRead?: boolean
}): Promise<NotificationListResult | Error> {
  const client = await createClient()

  const query: Record<string, string> = {
    limit: String(props.limit),
    offset: String(props.offset),
  }

  if (props.isRead !== undefined) {
    query.read = props.isRead ? "true" : "false"
  }

  const response = await client.system.notifications.$get({ query })

  if (response.status !== 200) {
    return new Error("failed to load my notifications")
  }

  const body = await response.json()

  return {
    data: body.notifications.map((notification) => ({
      id: notification.id,
      kind: notification.kind.replace(/^company:/u, "") as NotificationResponse["kind"],
      title: notification.title,
      body: notification.body,
      is_read: notification.read_at !== null,
      created_at: notification.delivered_at,
    })),
    total: body.total,
  }
}
