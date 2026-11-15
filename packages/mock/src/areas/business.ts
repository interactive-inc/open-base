import { HttpResponse } from "msw/http"
import type { Scenario } from "../types.ts"
import { defineMockArea, type MockAreaRequest } from "./area.ts"

type CatalogStatus = "active" | "inactive"
type ProjectStatus = "planned" | "active" | "completed" | "cancelled"

/** 記録の版に共通する情報。版は追記だけで、今の値は最大の版。 */
type Revision = {
  revision: number
  recorded_at: string
  reason: string
  actor_account_id: string
  request_id: string
}

type Customer = Revision & {
  id: string
  name: string
  aliases: string[]
  status: CatalogStatus
}

type Offering = Revision & {
  id: string
  name: string
  code: string
  type: "product" | "service"
  status: CatalogStatus
}

type Project = Revision & {
  kind: "project"
  id: string
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
  employee_id: string
}

type Effort = Revision & {
  kind: "effort"
  id: string
  project_id: string
  worked_on: string
  minutes: number
  status: "recorded" | "void"
  employee_id: string
}

type Definition = {
  id: string
  slug: string
  revision: number
  recorded_at: string
  name: string
  description: string
  tags: string[]
  agent_id: string | null
  owner_employee_id: string
  external_app_id: string | null
  document_reference: string | null
  execution_note: string
  status: "active" | "retired"
  reason: string
}

type Run = {
  id: string
  slug: string
  definition_revision: number
  started_at: string
  finished_at: string
  outcome: "succeeded" | "failed" | "needs_review"
  summary: string
  references: { kind: string; id: string }[]
  corrects_id: string | null
  trigger: "manual" | "scheduled" | "other" | null
  ai_assisted: boolean
  tool_label: string | null
  agent_id: string | null
  reporter_account_id: string
  definition_id: string
  received_at: string
}

/** この領域の架空の状態。記録はすべての版を持つ。 */
export type State = {
  disabledFeatures: string[]
  customers: Customer[]
  offerings: Offering[]
  projects: Project[]
  efforts: Effort[]
  definitions: Definition[]
  runs: Run[]
}

const ACCOUNT = "example-account"

/**
 * 担当者や責任者として参照する従業員。名簿は従業員の領域が持つので、そのモックのIDに合わせる。
 * 本物のAPIでは従業員IDはUUID。
 */
const EMPLOYEES = {
  owner: "employee-e0001",
  member: "employee-e0003",
} as const

const CUSTOMER = {
  manufacturing: "c0000000-0000-4000-8000-000000000001",
  logistics: "c0000000-0000-4000-8000-000000000002",
  retail: "c0000000-0000-4000-8000-000000000003",
  clinic: "c0000000-0000-4000-8000-000000000004",
  studio: "c0000000-0000-4000-8000-000000000005",
} as const

const OFFERING = {
  consulting: "0f000000-0000-4000-8000-000000000001",
  support: "0f000000-0000-4000-8000-000000000002",
  device: "0f000000-0000-4000-8000-000000000003",
} as const

const PROJECT = {
  review: "9a000000-0000-4000-8000-000000000001",
  maintenance: "9a000000-0000-4000-8000-000000000002",
  delivery: "9a000000-0000-4000-8000-000000000003",
  migration: "9a000000-0000-4000-8000-000000000004",
  members: "9a000000-0000-4000-8000-000000000005",
  booking: "9a000000-0000-4000-8000-000000000006",
} as const

const DEFINITION = {
  report: "de000000-0000-4000-8000-000000000001",
  followUp: "de000000-0000-4000-8000-000000000002",
  cleanup: "de000000-0000-4000-8000-000000000003",
} as const

const AGENT = "a9000000-0000-4000-8000-000000000001"

/** 日付と時刻から、版の情報を作る。 */
function meta(revision: number, at: string, reason: string): Revision {
  return {
    revision,
    recorded_at: `${at}.000Z`,
    reason,
    actor_account_id: ACCOUNT,
    request_id: `example-request-${revision}`,
  }
}

function seedCustomers(): Customer[] {
  return [
    {
      ...meta(1, "2026-09-01T01:00:00", "取引の開始"),
      id: CUSTOMER.manufacturing,
      name: "Example Manufacturing Co.",
      aliases: [],
      status: "active",
    },
    {
      ...meta(2, "2026-10-01T01:00:00", "社名の変更"),
      id: CUSTOMER.manufacturing,
      name: "Example Manufacturing",
      aliases: ["Example Mfg", "Example Manufacturing Co."],
      status: "active",
    },
    {
      ...meta(1, "2026-09-05T01:00:00", "取引の開始"),
      id: CUSTOMER.logistics,
      name: "Example Logistics",
      aliases: [],
      status: "active",
    },
    {
      ...meta(1, "2026-08-20T01:00:00", "取引の開始"),
      id: CUSTOMER.retail,
      name: "Example Retail",
      aliases: ["Example Shop"],
      status: "active",
    },
    {
      ...meta(1, "2026-06-01T01:00:00", "取引の開始"),
      id: CUSTOMER.clinic,
      name: "Example Clinic",
      aliases: [],
      status: "active",
    },
    {
      ...meta(2, "2026-10-20T01:00:00", "契約の終了"),
      id: CUSTOMER.clinic,
      name: "Example Clinic",
      aliases: [],
      status: "inactive",
    },
    {
      ...meta(1, "2026-11-10T01:00:00", "取引の開始"),
      id: CUSTOMER.studio,
      name: "Example Studio",
      aliases: [],
      status: "active",
    },
  ]
}

function seedOfferings(): Offering[] {
  return [
    {
      ...meta(1, "2026-04-01T01:00:00", "提供の開始"),
      id: OFFERING.consulting,
      name: "Example Consulting",
      code: "SV-CONSULT",
      type: "service",
      status: "active",
    },
    {
      ...meta(1, "2026-04-01T01:00:00", "提供の開始"),
      id: OFFERING.support,
      name: "Example Support Plan",
      code: "SV-SUPPORT",
      type: "service",
      status: "active",
    },
    {
      ...meta(1, "2026-04-01T01:00:00", "提供の開始"),
      id: OFFERING.device,
      name: "Example Device",
      code: "PR-DEVICE",
      type: "product",
      status: "active",
    },
    {
      ...meta(2, "2026-09-30T01:00:00", "販売の終了"),
      id: OFFERING.device,
      name: "Example Device",
      code: "PR-DEVICE",
      type: "product",
      status: "inactive",
    },
  ]
}

type ProjectSeed = Omit<Project, keyof Revision | "kind" | "employee_id" | "description"> & {
  description?: string
}

function project(revision: Revision, value: ProjectSeed): Project {
  return {
    ...revision,
    kind: "project",
    description: "",
    employee_id: EMPLOYEES.owner,
    ...value,
  }
}

function seedProjects(): Project[] {
  const review = {
    id: PROJECT.review,
    name: "生産管理の見直し",
    customer_id: CUSTOMER.manufacturing,
    offering_id: OFFERING.consulting,
    owner_employee_id: EMPLOYEES.owner,
    description: "工程ごとの記録を見直し、遅れの原因を洗い出す。",
    starts_on: "2026-10-01",
    due_on: "2026-12-25",
    remaining_minutes: 2400,
  }
  return [
    project(meta(1, "2026-09-20T01:00:00", "受注の見込み"), {
      ...review,
      status: "planned",
      planned_minutes: 4800,
    }),
    project(meta(2, "2026-10-01T01:00:00", "作業の開始"), {
      ...review,
      status: "active",
      planned_minutes: 6000,
    }),
    project(meta(1, "2026-11-05T01:00:00", "次期の保守を予定"), {
      id: PROJECT.maintenance,
      name: "保守の更新",
      customer_id: CUSTOMER.manufacturing,
      offering_id: OFFERING.support,
      owner_employee_id: EMPLOYEES.member,
      status: "planned",
      starts_on: "2027-01-05",
      due_on: "2027-01-31",
      planned_minutes: 1200,
      remaining_minutes: null,
    }),
    project(meta(1, "2026-10-10T01:00:00", "作業の開始"), {
      id: PROJECT.delivery,
      name: "配送記録の整理",
      customer_id: CUSTOMER.logistics,
      offering_id: OFFERING.consulting,
      owner_employee_id: EMPLOYEES.member,
      status: "active",
      starts_on: "2026-10-10",
      due_on: "2026-11-30",
      planned_minutes: 1800,
      remaining_minutes: 900,
    }),
    project(meta(1, "2026-08-25T01:00:00", "受注"), {
      id: PROJECT.migration,
      name: "店舗データの移行",
      customer_id: CUSTOMER.retail,
      offering_id: null,
      owner_employee_id: EMPLOYEES.owner,
      status: "completed",
      starts_on: "2026-09-01",
      due_on: "2026-10-31",
      planned_minutes: 2400,
      remaining_minutes: 0,
    }),
    project(meta(1, "2026-09-15T01:00:00", "顧客の都合で中止"), {
      id: PROJECT.members,
      name: "会員向けの改修",
      customer_id: CUSTOMER.retail,
      offering_id: OFFERING.consulting,
      owner_employee_id: EMPLOYEES.member,
      status: "cancelled",
      starts_on: null,
      due_on: null,
      planned_minutes: null,
      remaining_minutes: null,
    }),
    project(meta(1, "2026-07-01T01:00:00", "完了の報告"), {
      id: PROJECT.booking,
      name: "予約受付の改善",
      customer_id: CUSTOMER.clinic,
      offering_id: OFFERING.support,
      owner_employee_id: EMPLOYEES.owner,
      status: "completed",
      starts_on: "2026-06-01",
      due_on: "2026-06-30",
      planned_minutes: 600,
      remaining_minutes: 0,
    }),
  ]
}

function effort(
  id: number,
  projectId: string,
  workedOn: string,
  minutes: number,
  reason: string,
): Effort {
  return {
    ...meta(1, `${workedOn}T09:00:00`, reason),
    kind: "effort",
    id: `ef000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    project_id: projectId,
    worked_on: workedOn,
    minutes,
    status: "recorded",
    employee_id: EMPLOYEES.owner,
  }
}

function seedEfforts(): Effort[] {
  const mistaken = effort(4, PROJECT.review, "2026-11-04", 120, "打ち合わせ")
  return [
    effort(1, PROJECT.review, "2026-10-02", 480, "現状の聞き取り"),
    effort(2, PROJECT.review, "2026-10-16", 360, "工程の記録の分析"),
    effort(3, PROJECT.review, "2026-11-06", 240, "改善案のまとめ"),
    mistaken,
    { ...mistaken, ...meta(2, "2026-11-05T09:00:00", "日付の誤り"), status: "void" },
    {
      ...effort(5, PROJECT.delivery, "2026-10-14", 540, "記録の棚卸し"),
      employee_id: EMPLOYEES.member,
    },
    {
      ...effort(6, PROJECT.delivery, "2026-11-02", 420, "整理の手順づくり"),
      employee_id: EMPLOYEES.member,
    },
    effort(7, PROJECT.migration, "2026-09-10", 1200, "移行の準備"),
    effort(8, PROJECT.migration, "2026-10-20", 1320, "移行と確認"),
    effort(9, PROJECT.booking, "2026-06-15", 540, "受付の改善"),
  ]
}

function seedDefinitions(): Definition[] {
  const report = {
    id: DEFINITION.report,
    slug: "weekly-report",
    name: "週次の報告書づくり",
    description: "案件ごとの進み具合を週に一度まとめる。",
    agent_id: null,
    owner_employee_id: EMPLOYEES.owner,
    external_app_id: null,
    document_reference: "docs/weekly-report.md",
    status: "active" as const,
  }
  return [
    {
      ...report,
      revision: 1,
      recorded_at: "2026-09-01T01:00:00.000Z",
      tags: [],
      execution_note: "担当者が手動で始める。",
      reason: "業務の登録",
    },
    {
      ...report,
      revision: 2,
      recorded_at: "2026-10-01T01:00:00.000Z",
      tags: ["定期フォロー"],
      execution_note: "担当者が手動で始める。定期分は手元のAIツールが実行する。",
      reason: "実行方法の追記",
    },
    {
      id: DEFINITION.followUp,
      slug: "customer-follow-up",
      revision: 1,
      recorded_at: "2026-09-15T01:00:00.000Z",
      name: "顧客への定期連絡",
      description: "取引中の顧客に月に一度近況を伺う。",
      tags: ["顧客対応", "定期フォロー"],
      agent_id: AGENT,
      owner_employee_id: EMPLOYEES.member,
      external_app_id: null,
      document_reference: null,
      execution_note: "登録済みのagentが毎月実行する。",
      status: "active",
      reason: "業務の登録",
    },
    {
      id: DEFINITION.cleanup,
      slug: "data-cleanup",
      revision: 1,
      recorded_at: "2026-06-01T01:00:00.000Z",
      name: "古いデータの整理",
      description: "使わなくなった記録を整理する。",
      tags: [],
      agent_id: null,
      owner_employee_id: EMPLOYEES.owner,
      external_app_id: null,
      document_reference: null,
      execution_note: "",
      status: "active",
      reason: "業務の登録",
    },
    {
      id: DEFINITION.cleanup,
      slug: "data-cleanup",
      revision: 2,
      recorded_at: "2026-10-31T01:00:00.000Z",
      name: "古いデータの整理",
      description: "使わなくなった記録を整理する。",
      tags: [],
      agent_id: null,
      owner_employee_id: EMPLOYEES.owner,
      external_app_id: null,
      document_reference: null,
      execution_note: "",
      status: "retired",
      reason: "別の業務へ統合",
    },
  ]
}

function run(id: number, value: Omit<Run, "id" | "reporter_account_id">): Run {
  return {
    id: `a0000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
    reporter_account_id: ACCOUNT,
    ...value,
  }
}

function seedRuns(): Run[] {
  const common = {
    corrects_id: null,
    agent_id: null,
    ai_assisted: false,
    tool_label: null,
    references: [],
  }
  return [
    run(1, {
      ...common,
      slug: "data-cleanup",
      definition_revision: 1,
      definition_id: DEFINITION.cleanup,
      started_at: "2026-10-20T01:00:00.000Z",
      finished_at: "2026-10-20T02:30:00.000Z",
      received_at: "2026-10-20T02:31:00.000Z",
      outcome: "succeeded",
      summary: "使わなくなった記録を120件整理した。",
      trigger: "manual",
    }),
    run(2, {
      ...common,
      slug: "weekly-report",
      definition_revision: 2,
      definition_id: DEFINITION.report,
      started_at: "2026-11-06T00:00:00.000Z",
      finished_at: "2026-11-06T00:40:00.000Z",
      received_at: "2026-11-06T00:41:00.000Z",
      outcome: "failed",
      summary: "集計の元になる記録が読めず、途中で止まった。",
      trigger: "manual",
    }),
    run(3, {
      ...common,
      slug: "weekly-report",
      definition_revision: 2,
      definition_id: DEFINITION.report,
      started_at: "2026-11-06T00:00:00.000Z",
      finished_at: "2026-11-06T01:10:00.000Z",
      received_at: "2026-11-06T03:00:00.000Z",
      outcome: "succeeded",
      summary: "読み直して最後まで集計できた。前の記録の結果を訂正する。",
      trigger: "manual",
      corrects_id: "a0000000-0000-4000-8000-000000000002",
    }),
    run(4, {
      ...common,
      slug: "customer-follow-up",
      definition_revision: 1,
      definition_id: DEFINITION.followUp,
      started_at: "2026-11-10T00:00:00.000Z",
      finished_at: "2026-11-10T00:05:00.000Z",
      received_at: "2026-11-10T00:05:01.000Z",
      outcome: "needs_review",
      summary: "返信の内容に判断の要る質問があった。担当者が確かめる。",
      trigger: "scheduled",
      agent_id: AGENT,
      references: [{ kind: "customer", id: CUSTOMER.manufacturing }],
    }),
    run(5, {
      ...common,
      slug: "weekly-report",
      definition_revision: 2,
      definition_id: DEFINITION.report,
      started_at: "2026-11-13T00:00:00.000Z",
      finished_at: "2026-11-13T00:30:00.000Z",
      received_at: "2026-11-13T00:31:00.000Z",
      outcome: "succeeded",
      summary: "進行中の案件2件の進み具合をまとめた。",
      trigger: "scheduled",
      ai_assisted: true,
      tool_label: "Example Assistant",
      references: [
        { kind: "client-project", id: PROJECT.review },
        { kind: "client-project", id: PROJECT.delivery },
      ],
    }),
  ]
}

function seed(scenario: Scenario): State {
  const empty = scenario === "empty"
  return {
    disabledFeatures: [],
    customers: empty ? [] : seedCustomers(),
    offerings: empty ? [] : seedOfferings(),
    projects: empty ? [] : seedProjects(),
    efforts: empty ? [] : seedEfforts(),
    definitions: empty ? [] : seedDefinitions(),
    runs: empty ? [] : seedRuns(),
  }
}

/** 機能のキーと、そのAPIの接頭辞。 */
const FEATURES: ReadonlyArray<[string, string]> = [
  ["customer", "/customer/"],
  ["offering", "/offering/"],
  ["client-project", "/client-project/"],
  ["work-execution", "/work-execution/"],
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const invalid = () => HttpResponse.json({ error: "入力を確認してください" }, { status: 400 })
const conflict = () => HttpResponse.json({ error: "ほかの更新と重なりました" }, { status: 409 })

/** 最大の版だけを残す。 */
function latest<T extends { revision: number }>(items: ReadonlyArray<T>, key: (item: T) => string) {
  const current = new Map<string, T>()
  for (const item of items) {
    const prior = current.get(key(item))
    if (prior === undefined || prior.revision < item.revision) current.set(key(item), item)
  }
  return [...current.values()]
}

function page<T>(items: ReadonlyArray<T>, query: URLSearchParams) {
  const offset = Number(query.get("offset") ?? 0)
  const limit = Number(query.get("limit") ?? 50)
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    return null
  const data = items.slice(offset, offset + limit)
  return { data, next_offset: data.length === limit ? offset + limit : null }
}

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() !== "" && value.trim().length <= max
const nullableDate = (value: unknown) =>
  value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
const nullableMinutes = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0)

/** 版の記録を一つ足す。期待した版が今の版と違えば競合にする。 */
function appendRevision<T extends Revision & { id: string }>(
  list: T[],
  body: Record<string, unknown>,
  build: (revision: Revision) => T,
) {
  const expected = body.expected_revision
  if (typeof expected !== "number" || !Number.isInteger(expected) || expected < 0) return invalid()
  if (typeof body.id !== "string" || !UUID.test(body.id)) return invalid()
  const current = latest(
    list.filter((item) => item.id === body.id),
    (item) => item.id,
  )[0]
  if ((current?.revision ?? 0) !== expected) return conflict()
  const revision = expected + 1
  list.push(
    build({
      revision,
      recorded_at: new Date().toISOString(),
      reason: String(body.reason).trim(),
      actor_account_id: ACCOUNT,
      request_id: crypto.randomUUID(),
    }),
  )
  return HttpResponse.json({ id: body.id, revision })
}

/** 台帳（顧客、サービス）の一覧。名前と、それぞれの追加の項目で探す。 */
function listCatalog<T extends Revision & { id: string; name: string }>(
  items: ReadonlyArray<T>,
  query: URLSearchParams,
  extra: (item: T) => ReadonlyArray<string>,
) {
  const id = query.get("id")
  const search = query.get("search")?.toLowerCase() ?? null
  const history = query.get("history") === "true"
  if (history && id === null) return invalid()
  const source = history ? items : latest(items, (item) => item.id)
  const found = source
    .filter((item) => id === null || item.id === id)
    .filter(
      (item) =>
        search === null ||
        [item.name, ...extra(item)].some((value) => value.toLowerCase().includes(search)),
    )
    .sort((a, b) => a.id.localeCompare(b.id) || b.revision - a.revision)
  const result = page(found, query)
  return result === null ? invalid() : HttpResponse.json(result)
}

function handleCustomers({ state, method, query, body }: MockAreaRequest<State>) {
  if (method === "GET") return listCatalog(state.customers, query, (item) => item.aliases)
  if (method !== "POST") return null
  const aliases = body.aliases ?? []
  if (
    !text(body.name, 200) ||
    !text(body.reason, 3000) ||
    !Array.isArray(aliases) ||
    aliases.length > 20 ||
    !aliases.every((alias) => text(alias, 200)) ||
    (body.status !== "active" && body.status !== "inactive")
  )
    return invalid()
  return appendRevision(state.customers, body, (revision) => ({
    ...revision,
    id: String(body.id),
    name: String(body.name).trim(),
    aliases: aliases.map((alias) => String(alias).trim()),
    status: body.status as CatalogStatus,
  }))
}

function handleOfferings({ state, method, query, body }: MockAreaRequest<State>) {
  if (method === "GET") return listCatalog(state.offerings, query, (item) => [item.code])
  if (method !== "POST") return null
  if (
    !text(body.name, 200) ||
    !text(body.code, 200) ||
    !text(body.reason, 3000) ||
    (body.type !== "product" && body.type !== "service") ||
    (body.status !== "active" && body.status !== "inactive")
  )
    return invalid()
  return appendRevision(state.offerings, body, (revision) => ({
    ...revision,
    id: String(body.id),
    name: String(body.name).trim(),
    code: String(body.code).trim(),
    type: body.type as Offering["type"],
    status: body.status as CatalogStatus,
  }))
}

/** 案件の応答。実績は今の有効な工数の合計、当初の予定は初版の予定。 */
function presentProject(state: State, item: Project, history: boolean) {
  const { employee_id, ...record } = item
  const actual = history
    ? null
    : latest(
        state.efforts.filter((effort) => effort.project_id === item.id),
        (effort) => effort.id,
      )
        .filter((effort) => effort.status === "recorded")
        .reduce((sum, effort) => sum + effort.minutes, 0)
  const baseline =
    state.projects.find((other) => other.id === item.id && other.revision === 1)?.planned_minutes ??
    null
  const forecast =
    actual !== null && item.remaining_minutes !== null ? actual + item.remaining_minutes : null
  return {
    ...record,
    created_by_employee_id: employee_id,
    baseline_minutes: baseline,
    actual_minutes: actual,
    forecast_minutes: forecast,
    variance_minutes:
      forecast !== null && item.planned_minutes !== null ? forecast - item.planned_minutes : null,
  }
}

function handleClientProjects(request: MockAreaRequest<State>) {
  const { state, method, query, body } = request
  if (method === "GET") {
    const kind = query.get("kind")
    const id = query.get("id")
    const projectId = query.get("project_id")
    const customerId = query.get("customer_id")
    const search = query.get("search")?.toLowerCase() ?? null
    const history = query.get("history") === "true"
    if (
      (kind !== "project" && kind !== "effort") ||
      (history && id === null) ||
      (projectId !== null && kind !== "effort") ||
      (customerId !== null && kind !== "project") ||
      (search !== null && kind === "effort")
    )
      return invalid()
    if (kind === "project") {
      const source = history ? state.projects : latest(state.projects, (item) => item.id)
      const found = source
        .filter((item) => id === null || item.id === id)
        .filter((item) => customerId === null || item.customer_id === customerId)
        .filter((item) => search === null || item.name.toLowerCase().includes(search))
        .sort((a, b) => a.id.localeCompare(b.id) || b.revision - a.revision)
        .map((item) => presentProject(state, item, history))
      const result = page(found, query)
      return result === null ? invalid() : HttpResponse.json(result)
    }
    const source = history ? state.efforts : latest(state.efforts, (item) => item.id)
    const found = source
      .filter((item) => id === null || item.id === id)
      .filter((item) => projectId === null || item.project_id === projectId)
      .sort((a, b) => a.id.localeCompare(b.id) || b.revision - a.revision)
    const result = page(found, query)
    return result === null ? invalid() : HttpResponse.json(result)
  }
  if (method !== "POST") return null
  if (request.root.scenario === "member") return forbidden()
  if (!text(body.reason, 3000)) return invalid()
  if (body.kind === "project") {
    if (
      !text(body.name, 200) ||
      typeof body.customer_id !== "string" ||
      !UUID.test(body.customer_id) ||
      (body.offering_id !== null &&
        (typeof body.offering_id !== "string" || !UUID.test(body.offering_id))) ||
      !text(body.owner_employee_id, 128) ||
      typeof body.description !== "string" ||
      !["planned", "active", "completed", "cancelled"].includes(String(body.status)) ||
      !nullableDate(body.starts_on) ||
      !nullableDate(body.due_on) ||
      (body.starts_on !== null &&
        body.due_on !== null &&
        String(body.starts_on) > String(body.due_on)) ||
      !nullableMinutes(body.planned_minutes) ||
      !nullableMinutes(body.remaining_minutes)
    )
      return invalid()
    return appendRevision(state.projects, body, (revision) => ({
      ...revision,
      kind: "project" as const,
      id: String(body.id),
      name: String(body.name).trim(),
      customer_id: String(body.customer_id),
      offering_id: body.offering_id === null ? null : String(body.offering_id),
      owner_employee_id: String(body.owner_employee_id),
      description: String(body.description).trim(),
      status: body.status as ProjectStatus,
      starts_on: body.starts_on as string | null,
      due_on: body.due_on as string | null,
      planned_minutes: body.planned_minutes as number | null,
      remaining_minutes: body.remaining_minutes as number | null,
      employee_id: EMPLOYEES.owner,
    }))
  }
  if (body.kind === "effort") {
    const minutes = body.minutes
    if (
      typeof body.project_id !== "string" ||
      !UUID.test(body.project_id) ||
      typeof body.worked_on !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.worked_on) ||
      typeof minutes !== "number" ||
      !Number.isInteger(minutes) ||
      minutes < 1 ||
      minutes > 1440 ||
      (body.status !== "recorded" && body.status !== "void")
    )
      return invalid()
    // 工数を変えられるのは記録した本人だけ。
    const prior = state.efforts.find((item) => item.id === body.id)
    if (prior !== undefined && prior.employee_id !== EMPLOYEES.owner) return conflict()
    return appendRevision(state.efforts, body, (revision) => ({
      ...revision,
      kind: "effort" as const,
      id: String(body.id),
      project_id: String(body.project_id),
      worked_on: String(body.worked_on),
      minutes,
      status: body.status as Effort["status"],
      employee_id: EMPLOYEES.owner,
    }))
  }
  return invalid()
}

function handleDefinitions({ state, method, query, body, root }: MockAreaRequest<State>) {
  if (method === "GET") {
    const slug = query.get("slug")
    const tag = query.get("tag")
    const revision = query.get("revision")
    if (revision !== null && slug === null) return invalid()
    const source =
      revision === null
        ? latest(state.definitions, (item) => item.slug)
        : state.definitions.filter((item) => item.revision === Number(revision))
    const found = source
      .filter((item) => slug === null || item.slug === slug)
      .filter((item) => tag === null || item.tags.includes(tag))
      .sort((a, b) => a.slug.localeCompare(b.slug))
    const result = page(found, query)
    return result === null ? invalid() : HttpResponse.json(result)
  }
  if (method !== "POST") return null
  if (root.scenario === "member") return forbidden()
  const expected = body.expected_revision
  const tags = body.tags ?? []
  if (
    typeof body.slug !== "string" ||
    !SLUG.test(body.slug) ||
    typeof expected !== "number" ||
    !Number.isInteger(expected) ||
    expected < 0 ||
    !text(body.name, 100) ||
    !text(body.reason, 500) ||
    !text(body.owner_employee_id, 128) ||
    (body.agent_id !== null &&
      body.agent_id !== undefined &&
      (typeof body.agent_id !== "string" || !UUID.test(body.agent_id))) ||
    !Array.isArray(tags) ||
    !tags.every((tag) => text(tag, 100)) ||
    (body.status !== "active" && body.status !== "retired") ||
    (expected === 0 && body.status !== "active") ||
    (body.external_app_id != null && body.agent_id == null)
  )
    return invalid()
  const slug = body.slug
  const current = latest(
    state.definitions.filter((item) => item.slug === slug),
    (item) => item.slug,
  )[0]
  if ((current?.revision ?? 0) !== expected) return conflict()
  const revision = expected + 1
  state.definitions.push({
    id: current?.id ?? crypto.randomUUID(),
    slug,
    revision,
    recorded_at: new Date().toISOString(),
    name: String(body.name).trim(),
    description: String(body.description ?? "").trim(),
    tags: tags.map((tag) => String(tag).trim()),
    agent_id: (body.agent_id as string | null | undefined) ?? null,
    owner_employee_id: String(body.owner_employee_id),
    external_app_id: (body.external_app_id as string | null | undefined) ?? null,
    document_reference: (body.document_reference as string | null | undefined) ?? null,
    execution_note: String(body.execution_note ?? "").trim(),
    status: body.status,
    reason: String(body.reason).trim(),
  })
  return HttpResponse.json({ id: current?.id ?? slug, revision })
}

function handleRuns({ state, method, query, body, root }: MockAreaRequest<State>) {
  if (method === "GET") {
    const slug = query.get("slug")
    const tag = query.get("tag")
    const agentId = query.get("agent_id")
    const since = query.get("since")
    const found = state.runs
      .filter((item) => slug === null || item.slug === slug)
      .filter((item) => agentId === null || item.agent_id === agentId)
      .filter((item) => since === null || item.started_at >= since)
      .filter(
        (item) =>
          tag === null ||
          state.definitions.some(
            (definition) =>
              definition.slug === item.slug &&
              definition.revision === item.definition_revision &&
              definition.tags.includes(tag),
          ),
      )
      .sort((a, b) => b.received_at.localeCompare(a.received_at))
      .map((item) => ({
        ...item,
        owner_employee_id:
          state.definitions.find(
            (definition) =>
              definition.slug === item.slug && definition.revision === item.definition_revision,
          )?.owner_employee_id ?? EMPLOYEES.owner,
      }))
    const result = page(found, query)
    return result === null ? invalid() : HttpResponse.json(result)
  }
  if (method !== "POST") return null
  if (root.scenario === "member") return forbidden()
  const references = body.references ?? []
  if (
    typeof body.id !== "string" ||
    !UUID.test(body.id) ||
    typeof body.slug !== "string" ||
    typeof body.definition_revision !== "number" ||
    typeof body.started_at !== "string" ||
    typeof body.finished_at !== "string" ||
    body.started_at > body.finished_at ||
    !["succeeded", "failed", "needs_review"].includes(String(body.outcome)) ||
    typeof body.summary !== "string" ||
    !Array.isArray(references) ||
    (body.tool_label != null && body.ai_assisted !== true)
  )
    return invalid()
  const slug = body.slug
  const current = latest(
    state.definitions.filter((item) => item.slug === slug),
    (item) => item.slug,
  )[0]
  // 利用中の業務の今の版だけを受け付ける。訂正は同じ業務の自分の記録に限る。
  if (
    current === undefined ||
    current.status !== "active" ||
    current.revision !== body.definition_revision
  )
    return conflict()
  const corrects = (body.corrects_id as string | null | undefined) ?? null
  if (
    corrects !== null &&
    !state.runs.some((item) => item.id === corrects && item.definition_id === current.id)
  )
    return conflict()
  if (state.runs.some((item) => item.id === body.id)) return conflict()
  state.runs.push({
    id: body.id,
    slug,
    definition_revision: current.revision,
    started_at: body.started_at,
    finished_at: body.finished_at,
    outcome: body.outcome as Run["outcome"],
    summary: body.summary.trim(),
    references: references as Run["references"],
    corrects_id: corrects,
    trigger: (body.trigger as Run["trigger"] | undefined) ?? null,
    ai_assisted: body.ai_assisted === true,
    tool_label: (body.tool_label as string | null | undefined) ?? null,
    agent_id: null,
    reporter_account_id: ACCOUNT,
    definition_id: current.id,
    received_at: new Date().toISOString(),
  })
  return HttpResponse.json({ id: body.id, revision: current.revision })
}

function forbidden() {
  return HttpResponse.json({ error: "この操作をする権限がありません" }, { status: 403 })
}

export const area = defineMockArea<State>({
  name: "business",
  seed,
  handle: (request) => {
    const { state, path, method, root } = request
    // 機能の有効・無効の一覧。共通の経路だが、ほかに返す所が無いのでこの領域が返す。
    if (path === "/company/features" && method === "GET")
      return HttpResponse.json({ disabled_features: state.disabledFeatures })
    const feature = FEATURES.find(([, prefix]) => path.startsWith(prefix))
    if (feature === undefined) return null
    // 無効な機能は、存在を漏らさないよう404にする。
    if (state.disabledFeatures.includes(feature[0]))
      return HttpResponse.json({ error: "見つかりません" }, { status: 404 })
    // 従業員と結び付いていない人は、在籍を確かめられないので読めない。
    if (root.scenario === "unlinked") return forbidden()
    if (path === "/customer/records") {
      if (method === "POST" && root.scenario === "member") return forbidden()
      return handleCustomers(request)
    }
    if (path === "/offering/records") {
      if (method === "POST" && root.scenario === "member") return forbidden()
      return handleOfferings(request)
    }
    if (path === "/client-project/records") return handleClientProjects(request)
    if (path === "/work-execution/definitions") return handleDefinitions(request)
    if (path === "/work-execution/runs") return handleRuns(request)
    return null
  },
})
