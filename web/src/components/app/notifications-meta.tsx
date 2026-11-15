import {
  formatDeliveredAt,
  notificationKindLabel,
  notificationPriorityLabel,
  type SystemNotification,
} from "@/components/app/notifications-model"
import { Badge } from "@/components/ui/badge"

/**
 * 通知の種類、届いた日時、未読と優先度の札を一行に並べる。
 * 未読は色だけに頼らず「未読」の文字で示す。
 */
export function NotificationMeta({ notification }: { notification: SystemNotification }) {
  const priority = notificationPriorityLabel(notification.priority)

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {notification.read_at === null && <Badge variant="secondary">未読</Badge>}
      {priority !== null && <Badge variant="destructive">{priority}</Badge>}
      <span>{notificationKindLabel(notification.kind)}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={notification.delivered_at}>
        {formatDeliveredAt(notification.delivered_at)}
      </time>
    </span>
  )
}
