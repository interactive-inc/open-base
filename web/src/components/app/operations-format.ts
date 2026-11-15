import type {
  AuditOutcome,
  Connector,
  DeliveryStatus,
  ExchangeStatus,
  WorkAction,
  WorkItem,
  WorkState,
} from "@/components/app/operations-types"

/**
 * 状態の札（Badge）の見た目。止まっている・失敗したものは `destructive`、
 * 手当てを待つものや進んでいるものは `secondary`、終わったものは `outline`。
 */
export type StatusVariant = "destructive" | "secondary" | "outline"

/** 状態の呼び名と札の見た目。 */
export type StatusLabel = { text: string; variant: StatusVariant }

/** 日時を「2026/11/14 09:30」の形にする。読めない値はそのまま返す。 */
export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date)
}

/** 長い識別子を先頭だけにする。全体は `title` などで別に見せる。 */
export function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

/**
 * 日付の入力（YYYY-MM-DD）を、日本時間のその日の0時を指す秒単位のUTC時刻にする。
 * `endOfDay` のときは翌日の0時にし、その日の終わりまでを含む半開区間の終点にする。
 */
export function dateToInstant(value: string, endOfDay = false): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00+09:00`)
  if (Number.isNaN(date.getTime())) return null
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().replace(/\.\d{3}Z$/, "Z")
}

export const OUTCOME: Readonly<Record<AuditOutcome, StatusLabel>> = {
  succeeded: { text: "成功", variant: "secondary" },
  denied: { text: "拒否", variant: "destructive" },
  failed: { text: "失敗", variant: "destructive" },
}

export const DELIVERY_STATUS: Readonly<Record<DeliveryStatus, StatusLabel>> = {
  dead_letter: { text: "止まっている", variant: "destructive" },
  leased: { text: "処理中", variant: "secondary" },
  queued: { text: "待機中", variant: "secondary" },
  succeeded: { text: "完了", variant: "outline" },
}

export const EXCHANGE_STATUS: Readonly<Record<ExchangeStatus, StatusLabel>> = {
  failed: { text: "失敗", variant: "destructive" },
  pending: { text: "進行中", variant: "secondary" },
  succeeded: { text: "成功", variant: "outline" },
  cancelled: { text: "取消", variant: "secondary" },
}

export const CONNECTOR_STATUS: Readonly<Record<Connector["status"], StatusLabel>> = {
  active: { text: "使用中", variant: "outline" },
  disabled: { text: "停止中", variant: "destructive" },
}

export const CONNECTOR_DIRECTION: Readonly<Record<Connector["direction"], string>> = {
  inbound: "受け取る",
  outbound: "送る",
  bidirectional: "送受信",
}

export const CONNECTOR_TRANSPORT: Readonly<Record<Connector["transport"], string>> = {
  api: "API",
  file: "ファイル",
  webhook: "Webhook",
}

export const WORK_STATE: Readonly<Record<WorkState, StatusLabel>> = {
  offered: { text: "受領待ち", variant: "secondary" },
  active: { text: "作業中", variant: "secondary" },
  review_pending: { text: "確認待ち", variant: "secondary" },
  completed: { text: "完了", variant: "outline" },
  cancelled: { text: "中止", variant: "outline" },
}

export const WORK_ACTION: Readonly<Record<WorkAction, string>> = {
  create: "依頼",
  accept: "受領",
  submit: "成果の提出",
  approve: "承認して完了",
  return: "差し戻し",
  request_handover: "引き継ぎの依頼",
  accept_handover: "引き継ぎの受領",
  decline_handover: "引き継ぎの辞退",
  cancel: "中止",
}

/** 受領・成果の確認・引き継ぎの受領を待っている作業。 */
export function needsAttention(item: WorkItem): boolean {
  return item.state === "offered" || item.state === "review_pending" || item.handover !== null
}

/** 期限を過ぎてまだ終わっていない作業。 */
export function isOverdue(item: WorkItem, now: Date = new Date()): boolean {
  if (item.dueAt === null || item.state === "completed" || item.state === "cancelled") return false
  return Date.parse(item.dueAt) < now.getTime()
}
