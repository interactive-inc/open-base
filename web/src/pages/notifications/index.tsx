import { ArrowRightIcon, BellIcon, CheckCheckIcon, CircleAlertIcon, InboxIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  EmptyState,
  Loaded,
  PageHeader,
  RowsSkeleton,
  ViewSwitch,
} from "@/components/app/data-view"
import { NotificationMeta } from "@/components/app/notifications-meta"
import {
  NOTIFICATIONS_PAGE_SIZE,
  notificationsApiPath,
  notificationsHref,
  notificationTargetHref,
  type InboxCounts,
  type NotificationPage,
  type NotificationsView,
  type SystemNotification,
  type UnreadCount,
} from "@/components/app/notifications-model"
import { sendApiJson, useApiJson } from "@/components/app/use-api-json"
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Props } from "./index.server"

type NotificationsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 自分宛ての通知の一覧。未読だけに絞り、一件ずつまたはまとめて既読にできる。 */
export default function Notifications({
  email,
  pathname,
  unreadOnly,
  offset,
  initial,
}: NotificationsProps) {
  const view: NotificationsView = { unreadOnly, offset }
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const page = useApiJson<NotificationPage>(notificationsApiPath(view), initial?.notifications)
  const unread = useApiJson<UnreadCount>("/system/notifications/unread-count", initial?.unread)
  const inbox = useApiJson<InboxCounts>("/company/inbox/counts", initial?.inbox)
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unreadCount = unread.kind === "ok" ? unread.data.unread_count : null

  async function markRead(target: "all" | SystemNotification) {
    setSending(target === "all" ? "all" : target.id)
    setError(null)
    const result =
      target === "all"
        ? await sendApiJson("PATCH", "/system/notifications", { read: true })
        : await sendApiJson("PATCH", `/system/notifications/${encodeURIComponent(target.id)}`, {
            read: true,
          })
    if (result.kind === "error") setError(result.message)
    await Promise.all([page.reload(), unread.reload()])
    setSending(null)
  }

  return (
    <>
      <PageHeader
        title="通知"
        description={
          unreadCount !== null && unreadCount > 0
            ? `未読の通知が ${unreadCount} 件あります。`
            : "あなた宛ての通知がここに届きます。"
        }
        action={
          unreadCount !== null &&
          unreadCount > 0 && (
            <Button disabled={sending !== null} onClick={() => markRead("all")}>
              <CheckCheckIcon data-icon="inline-start" aria-hidden="true" />
              すべて既読にする
            </Button>
          )
        }
      />

      {inbox.kind === "ok" && inbox.data.applications > 0 && (
        <Alert role="status">
          <InboxIcon aria-hidden="true" />
          <AlertDescription>
            あなたの判断を待っている申請が {inbox.data.applications} 件あります。
          </AlertDescription>
          <AlertAction>
            <Button variant="secondary" size="sm" render={<Link href="/" />}>
              承認を開く
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </AlertAction>
        </Alert>
      )}

      <div className="flex flex-col gap-4">
        <ViewSwitch
          label="通知の絞り込み"
          current={notificationsHref({ unreadOnly, offset: 0 })}
          items={[
            { href: notificationsHref({ unreadOnly: false, offset: 0 }), label: "すべて" },
            {
              href: notificationsHref({ unreadOnly: true, offset: 0 }),
              label: `未読だけ${unreadCount === null ? "" : `（${unreadCount}）`}`,
            },
          ]}
        />

        {error !== null && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Loaded state={page} fallback={<RowsSkeleton />}>
          {(data) =>
            data.notifications.length === 0 ? (
              <EmptyState
                icon={BellIcon}
                title={unreadOnly ? "未読の通知はありません" : "通知はまだありません"}
                description={
                  unreadOnly
                    ? "すべて読み終えています。過去の通知は「すべて」から見られます。"
                    : "申請の結果やお知らせが届くと、ここに出ます。"
                }
                action={
                  offset > 0 && (
                    <Button
                      variant="secondary"
                      render={<Link href={notificationsHref({ unreadOnly, offset: 0 })} />}
                    >
                      最初の頁へ戻る
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <ul className="flex flex-col gap-4">
                  {data.notifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      sending={sending}
                      onMarkRead={() => markRead(notification)}
                    />
                  ))}
                </ul>
                <Pager view={view} total={data.total} shown={data.notifications.length} />
              </>
            )
          }
        </Loaded>
      </div>
    </>
  )
}

/** 一件のカード。未読は「未読」の札と太い題で示す。 */
function NotificationRow(props: {
  notification: SystemNotification
  sending: string | null
  onMarkRead: () => Promise<void>
}) {
  const { notification } = props
  const isUnread = notification.read_at === null
  const target = notificationTargetHref(notification)

  return (
    <li>
      <Card>
        <CardHeader>
          <NotificationMeta notification={notification} />
          <CardTitle>
            <h2 className={isUnread ? "font-semibold break-words" : "font-normal break-words"}>
              <Link
                href={`/notifications/${encodeURIComponent(notification.id)}`}
                className="hover:underline"
              >
                {notification.title}
              </Link>
            </h2>
          </CardTitle>
          {isUnread && (
            <CardAction>
              <Button
                variant="secondary"
                size="sm"
                disabled={props.sending !== null}
                onClick={props.onMarkRead}
              >
                既読にする
                <span className="sr-only">：{notification.title}</span>
              </Button>
            </CardAction>
          )}
        </CardHeader>
        {notification.body !== null && (
          <CardContent>
            <p className="line-clamp-2 break-words whitespace-pre-wrap">{notification.body}</p>
          </CardContent>
        )}
        {target !== null && (
          <CardFooter>
            <Button variant="secondary" size="sm" render={<Link href={target} />}>
              関連する画面を開く
              <span className="sr-only">：{notification.title}</span>
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </li>
  )
}

/** 何件目を見ているかと、前後の頁への移動。一頁に収まるときは件数だけを出す。 */
function Pager(props: { view: NotificationsView; total: number; shown: number }) {
  const { view, total, shown } = props
  const first = view.offset + 1
  const last = view.offset + shown
  const hasPrevious = view.offset > 0
  const hasNext = last < total

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">
        全 {total} 件中 {first}–{last} 件目
      </p>
      {(hasPrevious || hasNext) && (
        <nav aria-label="通知の頁" className="flex gap-2">
          {hasPrevious && (
            <Button
              variant="secondary"
              render={
                <Link
                  href={notificationsHref({
                    ...view,
                    offset: Math.max(0, view.offset - NOTIFICATIONS_PAGE_SIZE),
                  })}
                />
              }
            >
              前へ
            </Button>
          )}
          {hasNext && (
            <Button
              variant="secondary"
              render={
                <Link
                  href={notificationsHref({
                    ...view,
                    offset: view.offset + NOTIFICATIONS_PAGE_SIZE,
                  })}
                />
              }
            >
              次へ
            </Button>
          )}
        </nav>
      )}
    </div>
  )
}
