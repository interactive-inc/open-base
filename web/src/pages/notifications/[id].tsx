import { ArrowRightIcon, CheckIcon, CircleAlertIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, Loaded, PageHeader } from "@/components/app/data-view"
import { NotificationMeta } from "@/components/app/notifications-meta"
import {
  formatDeliveredAt,
  notificationTargetHref,
  type SystemNotification,
} from "@/components/app/notifications-model"
import { sendApiJson, useApiJson } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 通知の一件。本文をすべて見せ、未読なら既読にする操作を置く。 */
export default function NotificationDetailPage({ email, pathname, id, initial }: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const notification = useApiJson<SystemNotification>(
    `/system/notifications/${encodeURIComponent(id)}`,
    initial?.notification,
  )

  return (
    <>
      <BackLink href="/notifications">通知の一覧</BackLink>

      <Loaded state={notification} fallback={<Skeleton className="h-48 w-full" />}>
        {(data) => <Detail notification={data} onChanged={notification.reload} />}
      </Loaded>
    </>
  )
}

function Detail(props: { notification: SystemNotification; onChanged: () => Promise<void> }) {
  const { notification } = props
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const target = notificationTargetHref(notification)
  const isUnread = notification.read_at === null

  async function markRead() {
    setSending(true)
    setError(null)
    const result = await sendApiJson(
      "PATCH",
      `/system/notifications/${encodeURIComponent(notification.id)}`,
      {
        read: true,
      },
    )
    if (result.kind === "error") setError(result.message)
    else await props.onChanged()
    setSending(false)
  }

  return (
    <>
      <PageHeader
        title={<span className="break-words">{notification.title}</span>}
        description={
          notification.read_at !== null
            ? `${formatDeliveredAt(notification.read_at)} に既読`
            : undefined
        }
        badges={<NotificationMeta notification={notification} />}
        action={
          isUnread && (
            <Button variant="secondary" disabled={sending} onClick={markRead}>
              <CheckIcon data-icon="inline-start" aria-hidden="true" />
              既読にする
            </Button>
          )
        }
      />

      {error !== null && (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>本文</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="break-words whitespace-pre-wrap">
            {notification.body ?? "本文はありません。"}
          </p>
        </CardContent>
        {target !== null && (
          <CardFooter className="justify-end">
            <Button render={<Link href={target} />}>
              関連する画面を開く
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  )
}
