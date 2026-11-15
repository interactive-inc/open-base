import { dateToInstant } from "@/components/app/operations-format"
import type { AuditDisclosureField, AuditOutcome } from "@/components/app/operations-types"

/** 会社の記録（業務の操作）か、システムの記録（基盤の操作）か。 */
export type AuditLedger = "company" | "system"

/** 監査の一覧の絞り込み。画面のURLのクエリと同じ名前で持つ。日付は YYYY-MM-DD。 */
export type AuditFilters = {
  from: string
  to: string
  actor: string
  action: string
  outcome: AuditOutcome | ""
}

export const EMPTY_FILTERS: AuditFilters = { from: "", to: "", actor: "", action: "", outcome: "" }

const OUTCOMES: ReadonlyArray<AuditOutcome> = ["succeeded", "denied", "failed"]

/** 画面のURLのクエリから絞り込みを読む。読めない値は無かったことにする。 */
export function readAuditQuery(query: URLSearchParams): {
  ledger: AuditLedger
  filters: AuditFilters
} {
  const date = (value: string | null) =>
    value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""
  const text = (value: string | null, max: number) =>
    value !== null && value.trim().length > 0 && value.length <= max ? value.trim() : ""
  const outcome = query.get("outcome")
  return {
    ledger: query.get("ledger") === "system" ? "system" : "company",
    filters: {
      from: date(query.get("from")),
      to: date(query.get("to")),
      actor: /^[0-9a-f-]{36}$/i.test(query.get("actor") ?? "") ? query.get("actor")! : "",
      action: text(query.get("action"), 200),
      outcome: OUTCOMES.find((item) => item === outcome) ?? "",
    },
  }
}

/** 画面のURL。絞り込みを共有できるよう、空でない条件だけをクエリに載せる。 */
export function auditPageUrl(ledger: AuditLedger, filters: AuditFilters): string {
  const query = new URLSearchParams()
  if (ledger === "system") query.set("ledger", "system")
  for (const [key, value] of Object.entries(filters)) if (value !== "") query.set(key, value)
  const text = query.toString()
  return text === "" ? "/operations/audit" : `/operations/audit?${text}`
}

/** 絞り込みからAPIの経路を作る。会社とシステムでクエリの名前が違う。 */
export function auditApiPath(ledger: AuditLedger, filters: AuditFilters): string {
  const query = new URLSearchParams({ limit: "50" })
  const from = filters.from === "" ? null : dateToInstant(filters.from)
  const to = filters.to === "" ? null : dateToInstant(filters.to, true)
  const system = ledger === "system"
  if (from !== null) query.set(system ? "occurred_from" : "from", from)
  if (to !== null) query.set(system ? "occurred_to" : "to", to)
  if (filters.actor !== "") query.set("actor_account_id", filters.actor)
  if (filters.action !== "") query.set("action", filters.action)
  if (filters.outcome !== "") query.set("outcome", filters.outcome)
  return `${system ? "/system/audit-events" : "/company/audit-events"}?${query.toString()}`
}

/** 期間の前後が逆になっていないか。APIは逆の期間を受け付けない。 */
export function auditRangeError(filters: AuditFilters): string | null {
  if (filters.from === "" || filters.to === "") return null
  return filters.from > filters.to ? "期間の始まりは終わりより前の日にしてください。" : null
}

export const DISCLOSURE_FIELDS: ReadonlyArray<{ key: AuditDisclosureField; label: string }> = [
  { key: "actor_account_id", label: "操作した人" },
  { key: "target_id", label: "対象の番号" },
  { key: "reason_code", label: "理由" },
  { key: "authorization_json", label: "認可の根拠" },
  { key: "before_json", label: "変更前の値" },
  { key: "after_json", label: "変更後の値" },
  { key: "metadata_json", label: "付帯の情報" },
]

/** 記録に入っている JSON の文字列を、読みやすく字下げする。読めないときはそのまま返す。 */
export function prettyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
