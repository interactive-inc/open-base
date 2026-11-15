import { pageApiReader } from "@/api/http/void-api-route"
import * as inboxCountsRoute from "@/api/routes/company.inbox.counts"
import * as notificationRoute from "@system/interface/routes/system.notifications.$id"
import * as notificationsRoute from "@system/interface/routes/system.notifications"
import * as unreadCountRoute from "@system/interface/routes/system.notifications.unread-count"

/**
 * 通知の画面のloaderが最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readNotifications = pageApiReader("/system/notifications", notificationsRoute.GET)

export const readNotification = pageApiReader("/system/notifications/:id", notificationRoute.GET)

export const readUnreadNotificationCount = pageApiReader(
  "/system/notifications/unread-count",
  unreadCountRoute.GET,
)

export const readInboxCounts = pageApiReader("/company/inbox/counts", inboxCountsRoute.GET)
