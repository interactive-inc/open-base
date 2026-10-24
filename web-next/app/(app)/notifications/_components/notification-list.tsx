"use client"

import { formatDateTime } from "@/lib/format-date-time"
import Link from "next/link"
import { useActionState } from "react"
import { toast } from "sonner"
import type { NotificationFormState } from "@/app/(app)/notifications/actions"
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(app)/notifications/actions"
import { EmptyState } from "@/components/empty-state"
import { StatusLabel } from "@/components/status-label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { NotificationResponse } from "@/lib/api/types/notification-types"

type Props = {
  notifications: Array<NotificationResponse>
}

const initialState: NotificationFormState = { ok: false, error: null }

/**
 * 通知一覧。各通知を Card で並べ、未読には既読化ボタンを出す。
 * 既読化・全件既読の結果は reducer ラッパー内で toast する（render 本体で toast しない）。
 */
export function NotificationList(props: Props) {
  async function markReduce(
    previousState: NotificationFormState,
    formData: FormData,
  ): Promise<NotificationFormState> {
    const result = await markNotificationReadAction(previousState, formData)
    if (result.ok) {
      toast.success("既読にしました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }
    return result
  }

  async function markAllReduce(
    previousState: NotificationFormState,
    _formData: FormData,
  ): Promise<NotificationFormState> {
    const result = await markAllNotificationsReadAction(previousState)
    if (result.ok) {
      toast.success("すべて既読にしました")
    } else if (result.error !== null) {
      toast.error(result.error)
    }
    return result
  }

  const [, markDispatch] = useActionState(markReduce, initialState)

  const [, markAllDispatch, isMarkingAll] = useActionState(markAllReduce, initialState)

  if (props.notifications.length === 0) {
    return (
      <EmptyState title="通知はありません" description="新しい通知が届くとここに表示されます。" />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <form action={markAllDispatch}>
          <Button type="submit" variant="secondary" disabled={isMarkingAll}>
            すべて既読にする
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        {props.notifications.map((notification) => (
          <Card key={notification.id} className={notification.is_read ? "opacity-70" : undefined}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{notification.title}</span>

                  {notification.kind === "thanks" ? (
                    <Link href="/thanks/thanks">
                      <Badge variant="secondary">感謝</Badge>
                    </Link>
                  ) : null}

                  {notification.is_read ? (
                    <StatusLabel>既読</StatusLabel>
                  ) : (
                    <StatusLabel>未読</StatusLabel>
                  )}
                </div>

                <span className="text-xs text-muted-foreground">
                  {formatDateTime(notification.created_at)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="flex items-start justify-between gap-4">
              <p className="whitespace-pre-wrap text-sm">{notification.body}</p>

              {notification.is_read ? null : (
                <form action={markDispatch}>
                  <input type="hidden" name="notification_id" value={notification.id} />

                  <Button type="submit" variant="secondary" size="sm">
                    既読にする
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
