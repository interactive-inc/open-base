"use server"

import { revalidatePath } from "next/cache"
import { createNotification } from "@/lib/api/create-notification"
import { getMe } from "@/lib/api/get-me"
import { markAllNotificationsRead } from "@/lib/api/mark-all-notifications-read"
import { markNotificationRead } from "@/lib/api/mark-notification-read"
import type { NotificationKind } from "@/lib/api/types/notification-types"
import { requireAuth } from "@/lib/auth/require-auth"
import { canManageNotifications } from "@/lib/notifications/can-manage-notifications"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type NotificationFormState = {
  ok: boolean
  error: string | null
}

/** 指定通知の既読化 Server Action。hidden input の notification_id を受け取る。 */
export async function markNotificationReadAction(
  _previousState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  await requireAuth()

  const notificationIdValue = formData.get("notification_id")
  const notificationId = typeof notificationIdValue === "string" ? notificationIdValue.trim() : ""

  if (notificationId === "") {
    return { ok: false, error: "通知 ID が不正です" }
  }

  const result = await markNotificationRead(notificationId)

  if (result instanceof Error) {
    return { ok: false, error: "既読化に失敗しました" }
  }

  revalidatePath("/notifications")

  return { ok: true, error: null }
}

/** 全件既読化 Server Action。 */
export async function markAllNotificationsReadAction(
  _previousState: NotificationFormState,
): Promise<NotificationFormState> {
  await requireAuth()

  const result = await markAllNotificationsRead()

  if (result instanceof Error) {
    return { ok: false, error: "全件既読化に失敗しました" }
  }

  revalidatePath("/notifications")

  return { ok: true, error: null }
}

/** FormData の kind を NotificationKind に正規化する。未知の値は announcement。 */
function toNotificationKind(value: FormDataEntryValue | null): NotificationKind {
  if (value === "task") {
    return "task"
  }

  if (value === "approval_request") {
    return "approval_request"
  }

  if (value === "approval_result") {
    return "approval_result"
  }

  if (value === "reminder") {
    return "reminder"
  }

  return "announcement"
}

/**
 * 通知作成 Server Action（特権ロール）。recipient_employee_code/kind/title 必須、body 任意。
 * 成功時は一覧へ redirect する。
 */
export async function createNotificationAction(
  _previousState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageNotifications(currentUser.permissions) === false) {
    return { ok: false, error: "通知を送信する権限がありません" }
  }

  const recipientCodeValue = formData.get("recipient_employee_code")

  const recipientEmployeeCode =
    typeof recipientCodeValue === "string" ? recipientCodeValue.trim() : ""

  if (recipientEmployeeCode === "") {
    return { ok: false, error: "宛先の社員コードを入力してください" }
  }

  const kind = toNotificationKind(formData.get("kind"))

  const titleValue = formData.get("title")

  const title = typeof titleValue === "string" ? titleValue.trim() : ""

  if (title === "") {
    return { ok: false, error: "タイトルを入力してください" }
  }

  const bodyValue = formData.get("body")

  const body =
    typeof bodyValue === "string" && bodyValue.trim() !== "" ? bodyValue.trim() : undefined

  const created = await createNotification({
    recipient_employee_code: recipientEmployeeCode,
    kind: kind,
    title: title,
    body: body,
  })

  if (created instanceof Error) {
    return { ok: false, error: "通知の作成に失敗しました" }
  }

  revalidatePath("/notifications")

  // redirect() せず ok:true を返す。クライアント側で遷移を処理し、
  // 成功フィードバック（toast等）が握り潰されるのを防ぐ。
  return { ok: true, error: null }
}
