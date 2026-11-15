import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import {
  readInboxCounts,
  readNotifications,
  readUnreadNotificationCount,
} from "@/api/http/notifications-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  notificationsApiPath,
  notificationsHref,
  readNotificationsView,
  type InboxCounts,
  type NotificationPage,
  type UnreadCount,
} from "@/components/app/notifications-model"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const view = readNotificationsView({ read: c.req.query("read"), offset: c.req.query("offset") })
  const user = getUser()
  if (user === null) {
    return c.redirect(`/sign-in?next=${encodeURIComponent(notificationsHref(view))}`)
  }
  const [profile, notifications, unread, inbox] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readNotifications<NotificationPage>(c, notificationsApiPath(view)),
    readUnreadNotificationCount<UnreadCount>(c),
    readInboxCounts<InboxCounts>(c),
  ])
  return {
    email: user.email,
    pathname: "/notifications",
    unreadOnly: view.unreadOnly,
    offset: view.offset,
    initial: { profile, notifications, unread, inbox },
  }
})

export const head = defineHead(() => ({
  title: "通知",
  bodyAttrs: { "data-shell": "app" },
}))
