/** 通知の参照。`type` は名前空間つきの語、`id` はその中の識別子。 */
export type NotificationReference = { type: string; id: string }

export type NotificationPriority = "low" | "normal" | "high" | "critical"

/** `GET /system/notifications` と `GET /system/notifications/:id` の一件。`id` は自分宛ての配信の番号。 */
export type SystemNotification = {
  id: string
  message_id: string
  kind: string
  title: string
  body: string | null
  source: NotificationReference | null
  action: NotificationReference | null
  resource_scope: NotificationReference | null
  priority: NotificationPriority
  delivered_at: string
  read_at: string | null
}

export type NotificationPage = {
  notifications: ReadonlyArray<SystemNotification>
  total: number
  limit: number
  offset: number
}

export type UnreadCount = { unread_count: number }

/** `GET /company/inbox/counts`。この画面では申請の承認待ちの件数だけを使う。 */
export type InboxCounts = { applications: number }

/** 一画面に出す件数。APIの既定と同じにする。 */
export const NOTIFICATIONS_PAGE_SIZE = 20

/** APIが受け付ける読み飛ばしの上限。 */
const MAX_OFFSET = 10_000

/** 一覧の絞り込みと位置。URLのクエリと同じ意味を持つ。 */
export type NotificationsView = { unreadOnly: boolean; offset: number }

/** URLのクエリから一覧の絞り込みと位置を読む。読めない値は先頭のすべてとして扱う。 */
export function readNotificationsView(query: {
  read: string | undefined | null
  offset: string | undefined | null
}): NotificationsView {
  const offset = Number(query.offset ?? "0")
  return {
    unreadOnly: query.read === "false",
    offset:
      Number.isSafeInteger(offset) && offset >= 0 && offset <= MAX_OFFSET
        ? offset - (offset % NOTIFICATIONS_PAGE_SIZE)
        : 0,
  }
}

/** 画面のURL。先頭のすべてのときはクエリを付けない。 */
export function notificationsHref(view: NotificationsView): string {
  const query = new URLSearchParams()
  if (view.unreadOnly) query.set("read", "false")
  if (view.offset > 0) query.set("offset", String(view.offset))
  const text = query.toString()
  return text === "" ? "/notifications" : `/notifications?${text}`
}

/** 一覧を読むAPIの経路。 */
export function notificationsApiPath(view: NotificationsView): string {
  const query = new URLSearchParams({
    limit: String(NOTIFICATIONS_PAGE_SIZE),
    offset: String(view.offset),
  })
  if (view.unreadOnly) query.set("read", "false")
  return `/system/notifications?${query.toString()}`
}

/** 詳細の画面へ渡す番号として受け付ける形。APIのparamの上限と合わせる。 */
export function isNotificationId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,255}$/.test(value)
}

const KIND_LABEL: ReadonlyMap<string, string> = new Map([
  ["company:task", "やること"],
  ["company:approval_request", "承認の依頼"],
  ["company:approval_result", "承認の結果"],
  ["company:reminder", "リマインド"],
  ["company:announcement", "お知らせ"],
  ["company:thanks", "感謝"],
  ["system:attachment.reconciliation", "添付の照合"],
])

/** 通知の種類を短い日本語にする。知らない種類は「通知」とする。 */
export function notificationKindLabel(kind: string): string {
  return KIND_LABEL.get(kind) ?? "通知"
}

const PRIORITY_LABEL: Readonly<Record<NotificationPriority, string | null>> = {
  low: null,
  normal: null,
  high: "重要",
  critical: "至急",
}

/** 目立たせる優先度だけ札の文を返す。 */
export function notificationPriorityLabel(priority: NotificationPriority): string | null {
  return PRIORITY_LABEL[priority] ?? null
}

/** Companyが通知を出すときの出所の型。`id` には `{"domain":…,"id":…}` のJSONが入る。 */
const COMPANY_SOURCE_TYPE = "company:notification.source"

/** 出所の業務の名前と、開く画面の対応。申請は申請番号で詳細を開く。 */
const COMPANY_SOURCE_PAGES: ReadonlyMap<string, (id: number) => string> = new Map([
  ["application_request", (id: number) => `/applications/${id}`],
])

/**
 * 通知から移れる画面のURL。画面が無い出所や、読めない出所はnullにする。
 * 通知の参照は送り手が決めるので、形を確かめてから使う。
 */
export function notificationTargetHref(notification: SystemNotification): string | null {
  const source = notification.source
  if (source === null || source.type !== COMPANY_SOURCE_TYPE) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(source.id)
  } catch {
    return null
  }
  if (typeof parsed !== "object" || parsed === null) return null
  const { domain, id } = parsed as { domain?: unknown; id?: unknown }
  if (typeof domain !== "string" || typeof id !== "number") return null
  if (!Number.isSafeInteger(id) || id <= 0) return null
  const page = COMPANY_SOURCE_PAGES.get(domain)
  return page === undefined ? null : page(id)
}

/** 届いた日時を「2026/11/14 9:05」の形にする。読めない値はそのまま返す。 */
export function formatDeliveredAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date)
}
