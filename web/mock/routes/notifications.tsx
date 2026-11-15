import NotificationDetail from "@/pages/notifications/[id]"
import Notifications from "@/pages/notifications/index"
import { readNotificationsView } from "@/components/app/notifications-model"
import type { MockRoute } from "./route"

/** `/notifications` は一覧、`/notifications/<番号>` は一件。 */
export const route: MockRoute = ({ path, query, email }) => {
  if (path === "/notifications") {
    const view = readNotificationsView({ read: query.get("read"), offset: query.get("offset") })
    return (
      <Notifications
        email={email}
        pathname="/notifications"
        unreadOnly={view.unreadOnly}
        offset={view.offset}
      />
    )
  }
  if (path.startsWith("/notifications/")) {
    const id = decodeURIComponent(path.slice("/notifications/".length))
    return <NotificationDetail email={email} pathname="/notifications" id={id} />
  }
  return null
}
