/**
 * 業務の領域（顧客、サービス、案件、業務の実行）の画面が読むAPIの応答の形。
 * 正本は各contextのrouteとrepositoryにある。画面はここで型を合わせるだけで、値を作らない。
 */

/** 台帳の一覧の応答。`next_offset` が null でなければ続きがある。 */
export type RecordPage<T> = { data: ReadonlyArray<T>; next_offset: number | null }

/** 記録の版に付く情報。 */
type RevisionMeta = {
  revision: number
  recorded_at: string
  request_id: string
  actor_account_id: string
}

export type CatalogStatus = "active" | "inactive"

export type CustomerRecord = RevisionMeta & {
  id: string
  name: string
  aliases: ReadonlyArray<string>
  status: CatalogStatus
  reason: string
}

export type OfferingType = "product" | "service"

export type OfferingRecord = RevisionMeta & {
  id: string
  name: string
  code: string
  type: OfferingType
  status: CatalogStatus
  reason: string
}

export type ProjectStatus = "planned" | "active" | "completed" | "cancelled"

export type ProjectRecord = RevisionMeta & {
  id: string
  kind: "project"
  name: string
  customer_id: string
  offering_id: string | null
  owner_employee_id: string
  description: string
  status: ProjectStatus
  starts_on: string | null
  due_on: string | null
  planned_minutes: number | null
  remaining_minutes: number | null
  created_by_employee_id: string
  reason: string
  baseline_minutes: number | null
  actual_minutes: number | null
  forecast_minutes: number | null
  variance_minutes: number | null
}

export type EffortStatus = "recorded" | "void"

export type EffortRecord = RevisionMeta & {
  id: string
  kind: "effort"
  project_id: string
  worked_on: string
  minutes: number
  status: EffortStatus
  employee_id: string
  reason: string
}

export type WorkDefinitionStatus = "active" | "retired"

export type WorkDefinition = {
  id: string
  slug: string
  revision: number
  recorded_at: string
  name: string
  description: string
  tags: ReadonlyArray<string>
  agent_id: string | null
  owner_employee_id: string
  external_app_id: string | null
  document_reference: string | null
  execution_note: string
  status: WorkDefinitionStatus
  reason: string
}

export type WorkOutcome = "succeeded" | "failed" | "needs_review"

export type WorkTrigger = "manual" | "scheduled" | "other"

export type WorkRun = {
  id: string
  slug: string
  definition_revision: number
  started_at: string
  finished_at: string
  outcome: WorkOutcome
  summary: string
  references: ReadonlyArray<{ kind: string; id: string }>
  corrects_id: string | null
  trigger: WorkTrigger | null
  ai_assisted: boolean
  tool_label: string | null
  agent_id: string | null
  reporter_account_id: string
  definition_id: string
  received_at: string
  owner_employee_id: string
}

/** `GET /company/features` の応答。無効な機能のキーが並ぶ。 */
export type FeatureAvailability = { disabled_features: ReadonlyArray<string> }

export type BusinessFeature = "customer" | "offering" | "client-project" | "work-execution"

/** 従業員名簿の一行。担当者の名前を出すときに使う。 */
export type DirectoryEmployee = { id: string; code: string; name: string; status: string }

export type EmployeeDirectory = { data: ReadonlyArray<DirectoryEmployee>; total: number }

export const PROJECT_STATUS_TEXT: Readonly<Record<ProjectStatus, string>> = {
  planned: "予定",
  active: "進行中",
  completed: "完了",
  cancelled: "中止",
}

export const PROJECT_STATUSES: ReadonlyArray<ProjectStatus> = [
  "planned",
  "active",
  "completed",
  "cancelled",
]

export const CATALOG_STATUS_TEXT: Readonly<Record<CatalogStatus, string>> = {
  active: "利用中",
  inactive: "利用停止",
}

export const OFFERING_TYPE_TEXT: Readonly<Record<OfferingType, string>> = {
  product: "商品",
  service: "サービス",
}

export const WORK_OUTCOME_TEXT: Readonly<Record<WorkOutcome, string>> = {
  succeeded: "成功",
  failed: "失敗",
  needs_review: "要確認",
}

export const WORK_TRIGGER_TEXT: Readonly<Record<WorkTrigger, string>> = {
  manual: "手動",
  scheduled: "定期",
  other: "その他",
}

export const WORK_DEFINITION_STATUS_TEXT: Readonly<Record<WorkDefinitionStatus, string>> = {
  active: "利用中",
  retired: "廃止",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 経路やクエリから受け取った値が、記録のIDとして読めるか。 */
export function isRecordId(value: string): boolean {
  return UUID.test(value)
}

/** 分を「12時間30分」の形にする。不明は「未入力」。 */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "未入力"
  const sign = minutes < 0 ? "-" : ""
  const total = Math.abs(minutes)
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours === 0) return `${sign}${rest}分`
  return rest === 0 ? `${sign}${hours}時間` : `${sign}${hours}時間${rest}分`
}

/** 日時を「2026年11月14日 9:30」の形にする。読めない値はそのまま返す。 */
export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date)
}

/** 案件を状態ごとに数える。 */
export function countByProjectStatus(
  projects: ReadonlyArray<Pick<ProjectRecord, "status">>,
): Readonly<Record<ProjectStatus, number>> {
  const counts: Record<ProjectStatus, number> = {
    planned: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
  }
  for (const project of projects) counts[project.status] += 1
  return counts
}

type ReadResult<T> = { kind: "ok"; data: T } | { kind: "forbidden" } | { kind: "error" }

/** 一件を取るAPIが無いので、新しい順に何ページまで探すか。 */
const RUN_SEARCH_PAGES = 10

/**
 * 実行の記録を一件探す。一覧を新しい順にたどり、見つからなければ null を返す。
 * 業務の識別名が分かれば絞り込んで探す。読み方はloaderとブラウザーで違うので `read` で受け取る。
 */
export async function findWorkRun(
  id: string,
  slug: string | null,
  read: (path: string) => Promise<ReadResult<RecordPage<WorkRun>>>,
): Promise<ReadResult<WorkRun | null>> {
  for (let page = 0; page < RUN_SEARCH_PAGES; page += 1) {
    const filter = slug === null ? "" : `&slug=${slug}`
    const result = await read(`/work-execution/runs?limit=100&offset=${page * 100}${filter}`)
    if (result.kind !== "ok") return result
    const found = result.data.data.find((run) => run.id === id)
    if (found !== undefined) return { kind: "ok", data: found }
    if (result.data.next_offset === null) break
  }
  return { kind: "ok", data: null }
}

/** 業務の識別名として読めるか。 */
export function isWorkSlug(value: string): boolean {
  return value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}
