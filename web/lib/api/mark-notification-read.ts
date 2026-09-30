import { createClient } from "@/lib/api/hc-client"

/** PATCH /system/notifications/:id。指定した通知を既読にする。 */
export async function markNotificationRead(notificationId: string): Promise<void | Error> {
  const client = await createClient()

  const response = await client.system.notifications[":id"].$patch({
    param: { id: String(notificationId) },
    json: { read: true },
  })

  if (response.status !== 200) {
    return new Error("failed to mark notification as read")
  }
}
