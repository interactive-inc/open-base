import type { Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

/**
 * 評価（`/performance-review`）の架空の状態と経路。
 * 状態の遷移は `ReviewSheetEntity` と同じ規則で進め、応答の形は本物のAPIに合わせる。
 * 承認経路の解決と会社上の判断資格は再現しない。`decider` が付いたシートだけを本人が判断できる。
 */

type Status =
  | "draft"
  | "goals_pending"
  | "goals_returned"
  | "goals_rejected"
  | "goals_approved"
  | "evaluation_pending"
  | "evaluation_returned"
  | "evaluation_rejected"
  | "finalized"
  | "cancelled"

type Policy = {
  version: 1
  scale: { value: number; label: string }[]
  sections: { key: string; name: string; weight: number }[]
}
type Goal = {
  id: string
  title: string
  success_criteria: string
  weight: number
  section_key: string
}
type Assessment = { goal_id: string; score: number; comment: string }
type SelfAssessment = Assessment & { actual: string }
type Step = {
  key: string
  name: string
  approvers: { type: string }[]
  rejection_behavior: "return" | "reject"
}
type Route = { revision: 1; workflow: { version: 1; steps: Step[] } }

type Cycle = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  evaluation_policy: Policy
  goals_procedure_key: string
  evaluation_procedure_key: string
  created_by_account_id: string
  created_at: string
  goal_approval: Route
  evaluation_approval: Route
}

type SheetData = {
  id: string
  cycle_id: string
  owner_account_id: string
  employee_id: string
  revision: number
  status: Status
  goals: Goal[]
  evaluation_policy: Policy
  self_assessments: SelfAssessment[]
  approval: {
    number: number
    proposal_id: string
    case_id: string
    phase: "goals" | "evaluation"
  } | null
  created_at: string
  updated_at: string
}

type Sheet = {
  data: SheetData
  /** 承認経路の何段階目か。 */
  step: number
  /** 本人がいま判断できるか（判断待ちの一覧に入るか）。 */
  decider: boolean
}

type HistoryEntry = {
  revision: number
  actor_account_id: string
  operation: string
  reason: string
  detail: unknown
  snapshot: SheetData
  request_id: string
  created_at: string
}

/** この領域の架空の状態。 */
export type State = {
  cycles: Cycle[]
  sheets: Sheet[]
  history: Record<string, HistoryEntry[]>
  /** 評価期間を作れるか。 */
  canManage: boolean
  /** 全員のシートを読めるか。 */
  canReadAll: boolean
  /** 新しい記録の時刻を進めるための数。 */
  clock: number
  proposals: number
}

const ME = "0a000000-0000-4000-8000-000000000001"
const MANAGER = "0a000000-0000-4000-8000-000000000002"
const OTHERS = [
  "0a000000-0000-4000-8000-000000000003",
  "0a000000-0000-4000-8000-000000000004",
  "0a000000-0000-4000-8000-000000000005",
  "0a000000-0000-4000-8000-000000000006",
  "0a000000-0000-4000-8000-000000000007",
] as const

const POLICY: Policy = {
  version: 1,
  scale: [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) })),
  sections: [{ key: "mbo", name: "目標", weight: 100 }],
}

const STEP_MANAGER: Step = {
  key: "manager",
  name: "上長確認",
  approvers: [{ type: "direct_manager" }],
  rejection_behavior: "return",
}
const STEP_DEPARTMENT: Step = {
  key: "department",
  name: "部門長確認",
  approvers: [{ type: "department_manager" }],
  rejection_behavior: "return",
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function id(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, "0")}`
}

function route(steps: Step[]): Route {
  return { revision: 1, workflow: { version: 1, steps: structuredClone(steps) } }
}

function cycle(
  n: number,
  name: string,
  startsOn: string,
  endsOn: string,
  createdAt: string,
  evaluationSteps: Step[],
): Cycle {
  const cycleId = id("c1000000", n)
  return {
    id: cycleId,
    name,
    starts_on: startsOn,
    ends_on: endsOn,
    evaluation_policy: structuredClone(POLICY),
    goals_procedure_key: `review_${cycleId.replaceAll("-", "")}_goals`,
    evaluation_procedure_key: `review_${cycleId.replaceAll("-", "")}_evaluation`,
    created_by_account_id: ME,
    created_at: createdAt,
    goal_approval: route([STEP_MANAGER]),
    evaluation_approval: route(evaluationSteps),
  }
}

function time(state: State): string {
  state.clock += 1
  return new Date(Date.UTC(2026, 10, 14, 1, state.clock)).toISOString()
}

function stepsOf(state: State, sheet: Sheet, phase: "goals" | "evaluation"): Step[] {
  const found = state.cycles.find((item) => item.id === sheet.data.cycle_id)
  const steps = (phase === "goals" ? found?.goal_approval : found?.evaluation_approval)?.workflow
    .steps
  return steps ?? [STEP_MANAGER]
}

function decisionTarget(state: State, sheet: Sheet) {
  if (sheet.data.approval === null || !sheet.data.status.endsWith("_pending")) return null
  const step = stepsOf(state, sheet, sheet.data.approval.phase)[sheet.step] ?? STEP_MANAGER
  return {
    proposal_version: 1,
    proposal_digest: "a".repeat(64),
    task_key: step.key,
    task_round: 1,
  }
}

function summarize(sheet: SheetData, assessments: Assessment[]) {
  const sections = sheet.evaluation_policy.sections.map((section) => ({
    ...section,
    weighted_score: sheet.goals
      .filter((goal) => goal.section_key === section.key)
      .reduce(
        (sum, goal) =>
          sum +
          ((assessments.find((item) => item.goal_id === goal.id)?.score ?? 0) * goal.weight) / 100,
        0,
      ),
  }))
  const score = sections.reduce(
    (sum, section) => sum + (section.weighted_score * section.weight) / 100,
    0,
  )
  const minimum = sheet.evaluation_policy.scale[0]?.value ?? 0
  const maximum = sheet.evaluation_policy.scale.at(-1)?.value ?? 1
  return {
    weighted_score: Math.round(score * 10000) / 10000,
    normalized_score: Math.round(((score - minimum) / (maximum - minimum)) * 10000) / 100,
    sections,
  }
}

/** 本物のAPIと同じく、失敗は状態の番号と `error` の短い符号で返す。 */
class Failure extends Error {
  readonly status: number
  readonly code: string

  // Nodeは型を取り除くだけで実行するので、引数をそのまま項目にする書き方は使えない。
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

function coversGoals(sheet: SheetData, assessments: Assessment[], policy: Policy) {
  const ids = new Set(assessments.map((item) => item.goal_id))
  if (
    ids.size !== assessments.length ||
    ids.size !== sheet.goals.length ||
    sheet.goals.some((goal) => !ids.has(goal.id))
  )
    throw new Failure(422, "assessments_must_cover_each_goal")
  for (const item of assessments) {
    if (!policy.scale.some((entry) => entry.value === item.score) || !item.comment?.trim())
      throw new Failure(422, "invalid_assessment")
  }
}

function readGoals(value: unknown, policy: Policy): Goal[] {
  if (!Array.isArray(value) || value.length > 20) throw new Failure(400, "invalid_goals")
  return value.map((raw) => {
    const goal = raw as Partial<Goal>
    if (
      typeof goal.id !== "string" ||
      typeof goal.title !== "string" ||
      !goal.title.trim() ||
      typeof goal.success_criteria !== "string" ||
      !goal.success_criteria.trim() ||
      typeof goal.weight !== "number" ||
      !Number.isInteger(goal.weight) ||
      goal.weight < 1 ||
      goal.weight > 100
    )
      throw new Failure(400, "invalid_goals")
    const sectionKey = goal.section_key ?? "mbo"
    if (!policy.sections.some((section) => section.key === sectionKey))
      throw new Failure(422, "unknown_evaluation_section")
    return {
      id: goal.id,
      title: goal.title.trim(),
      success_criteria: goal.success_criteria.trim(),
      weight: goal.weight,
      section_key: sectionKey,
    }
  })
}

/** 一つの操作を状態へ当てる。seedの履歴づくりと、画面からの操作の両方で使う。 */
function apply(
  state: State,
  sheet: Sheet,
  actor: string,
  body: Record<string, unknown>,
): SheetData {
  const data = sheet.data
  const operation = body.operation
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (reason === "") throw new Failure(400, "invalid_request")
  if (operation !== "decide" && data.owner_account_id !== actor)
    throw new Failure(403, "sheet_owner_required")
  if (body.expected_revision !== data.revision) throw new Failure(409, "review_revision_conflict")
  const policy = data.evaluation_policy
  const next: SheetData = structuredClone(data)
  let decider = sheet.decider
  let step = sheet.step
  const goalsOpen = ["draft", "goals_returned", "goals_rejected"].includes(data.status)
  const selfOpen = ["goals_approved", "evaluation_returned", "evaluation_rejected"].includes(
    data.status,
  )
  switch (operation) {
    case "revise_goals":
      if (!goalsOpen) throw new Failure(409, "goals_locked")
      next.goals = readGoals(body.goals, policy)
      if (next.goals.length === 0) throw new Failure(400, "invalid_goals")
      next.status = "draft"
      next.self_assessments = []
      break
    case "reopen_goals":
      if (data.status !== "goals_approved") throw new Failure(409, "goals_amendment_not_allowed")
      next.status = "draft"
      next.self_assessments = []
      next.approval = null
      break
    case "self_evaluate": {
      if (!selfOpen) throw new Failure(409, "self_assessment_locked")
      const assessments = (
        Array.isArray(body.assessments) ? body.assessments : []
      ) as SelfAssessment[]
      coversGoals(data, assessments, policy)
      if (assessments.some((item) => typeof item.actual !== "string" || !item.actual.trim()))
        throw new Failure(400, "invalid_assessment")
      next.self_assessments = assessments.map(({ goal_id, score, comment, actual }) => ({
        goal_id,
        score,
        comment,
        actual,
      }))
      next.status = "goals_approved"
      break
    }
    case "submit_goals":
      if (!goalsOpen) throw new Failure(409, "goals_not_submittable")
      for (const section of policy.sections) {
        const total = data.goals
          .filter((goal) => goal.section_key === section.key)
          .reduce((sum, goal) => sum + goal.weight, 0)
        if (total !== 100) throw new Failure(422, "goal_weights_must_total_100")
      }
      next.status = "goals_pending"
      break
    case "submit_evaluation":
      if (!selfOpen) throw new Failure(409, "evaluation_not_submittable")
      coversGoals(data, data.self_assessments, policy)
      next.status = "evaluation_pending"
      break
    case "cancel":
      if (data.status === "finalized" || data.status === "cancelled")
        throw new Failure(409, "sheet_closed")
      next.status = "cancelled"
      decider = false
      break
    case "decide": {
      const action = body.action
      if (data.approval === null || !data.status.endsWith("_pending"))
        throw new Failure(409, "sheet_not_pending")
      if (!sheet.decider || data.owner_account_id === actor)
        throw new Failure(403, "decision_not_authorized")
      const phase = data.approval.phase
      const steps = stepsOf(state, sheet, phase)
      const current = steps[sheet.step] ?? STEP_MANAGER
      if (action === "approve") {
        if (phase === "evaluation")
          coversGoals(
            data,
            (Array.isArray(body.assessments) ? body.assessments : []) as Assessment[],
            policy,
          )
        else if (body.assessments !== undefined) throw new Failure(422, "assessments_not_expected")
        if (sheet.step < steps.length - 1) step += 1
        else next.status = phase === "goals" ? "goals_approved" : "finalized"
      } else if (action === "return" || action === "reject") {
        if (body.assessments !== undefined) throw new Failure(422, "assessments_not_expected")
        if (action !== current.rejection_behavior)
          throw new Failure(422, "decision_action_does_not_match_workflow")
        next.status = `${phase}_${action === "return" ? "returned" : "rejected"}` as Status
      } else throw new Failure(400, "invalid_request")
      // 判断したあとは別の段階か本人の番になるので、判断待ちから外れる。
      decider = false
      break
    }
    default:
      throw new Failure(400, "invalid_request")
  }
  if (operation === "submit_goals" || operation === "submit_evaluation") {
    state.proposals += 1
    next.approval = {
      number: state.proposals,
      proposal_id: id("90000000", state.proposals),
      case_id: id("9c000000", state.proposals),
      phase: operation === "submit_goals" ? "goals" : "evaluation",
    }
    step = 0
  }
  const at = time(state)
  next.revision = data.revision + 1
  next.updated_at = at
  sheet.data = next
  sheet.decider = decider
  sheet.step = step
  const detail =
    operation === "decide" && body.action === "approve" && next.approval?.phase === "evaluation"
      ? { ...body, evaluation_summary: summarize(next, body.assessments as Assessment[]) }
      : body
  ;(state.history[next.id] ??= []).push({
    revision: next.revision,
    actor_account_id: actor,
    operation: String(operation),
    reason,
    detail,
    snapshot: structuredClone(next),
    request_id: `request-${state.clock}`,
    created_at: at,
  })
  return next
}

function createSheet(
  state: State,
  input: {
    id: string
    cycle: Cycle
    owner: string
    employee: string
    goals: Goal[]
    reason: string
  },
): Sheet {
  const at = time(state)
  const data: SheetData = {
    id: input.id,
    cycle_id: input.cycle.id,
    owner_account_id: input.owner,
    employee_id: input.employee,
    revision: 1,
    status: "draft",
    goals: input.goals,
    evaluation_policy: structuredClone(input.cycle.evaluation_policy),
    self_assessments: [],
    approval: null,
    created_at: at,
    updated_at: at,
  }
  const sheet: Sheet = { data, step: 0, decider: false }
  state.sheets.push(sheet)
  state.history[data.id] = [
    {
      revision: 1,
      actor_account_id: input.owner,
      operation: "create_sheet",
      reason: input.reason,
      detail: { id: input.id, cycle_id: input.cycle.id, goals: input.goals, reason: input.reason },
      snapshot: structuredClone(data),
      request_id: `request-${state.clock}`,
      created_at: at,
    },
  ]
  return sheet
}

const GOALS = [
  ["新しい申請の画面を公開する", "期末までに公開し、使い方の問い合わせを月10件以下にする"],
  ["確認待ちの時間を短くする", "変更の確認待ちを平均1営業日以内にする"],
  ["後輩の育成", "後輩2人が一人で作業を進められるようにする"],
] as const

function goals(sheetNumber: number, weights: number[]): Goal[] {
  return weights.map((weight, index) => ({
    id: id(`9a${String(sheetNumber).padStart(2, "0")}0000`, index + 1),
    title: GOALS[index % GOALS.length]![0],
    success_criteria: GOALS[index % GOALS.length]![1],
    weight,
    section_key: "mbo",
  }))
}

function selfAssessments(sheet: Sheet, scores: number[]): SelfAssessment[] {
  return sheet.data.goals.map((goal, index) => ({
    goal_id: goal.id,
    score: scores[index] ?? 3,
    actual: `目標${index + 1}は基準をおおむね満たしました。`,
    comment: "振り返りの記録と数字で確かめました。",
  }))
}

/** 操作を順に当てる。版は一つずつ進むので、期待する版はその時点の版を使う。 */
function run(
  state: State,
  sheet: Sheet,
  steps: Array<[string, Record<string, unknown>, boolean?]>,
) {
  for (const [actor, body, decider] of steps) {
    if (decider !== undefined) sheet.decider = decider
    apply(state, sheet, actor, { ...body, expected_revision: sheet.data.revision })
  }
}

function target() {
  return {
    proposal_version: 1,
    proposal_digest: "a".repeat(64),
    task_key: "manager",
    task_round: 1,
  }
}

function seed(scenario: Scenario): State {
  const admin = scenario !== "member" && scenario !== "unlinked"
  const state: State = {
    cycles: [],
    sheets: [],
    history: {},
    canManage: admin,
    canReadAll: admin,
    clock: 0,
    proposals: 0,
  }
  if (scenario === "empty") return state
  const later = cycle(3, "2027年度 上期", "2027-04-01", "2027-09-30", "2026-11-01T00:00:00.000Z", [
    STEP_MANAGER,
  ])
  const current = cycle(
    1,
    "2026年度 下期",
    "2026-10-01",
    "2027-03-31",
    "2026-09-15T00:00:00.000Z",
    [STEP_MANAGER, STEP_DEPARTMENT],
  )
  const previous = cycle(
    2,
    "2026年度 上期",
    "2026-04-01",
    "2026-09-30",
    "2026-03-15T00:00:00.000Z",
    [STEP_MANAGER],
  )
  // 一番古い期間にはシートが無い。シートを作る導線を見せるために使う。
  const oldest = cycle(4, "2025年度 下期", "2025-10-01", "2026-03-31", "2025-09-15T00:00:00.000Z", [
    STEP_MANAGER,
  ])
  state.cycles.push(later, current, previous, oldest)
  const submitGoals = { operation: "submit_goals", reason: "目標を提出します" }
  const approveGoals = {
    operation: "decide",
    action: "approve",
    target: target(),
    reason: "目標を承認します",
  }
  const submitEvaluation = { operation: "submit_evaluation", reason: "自己評価を提出します" }

  // 自分のシート。今期は自己評価を書く番、前期は確定、来期は目標を設定中。
  const s1 = createSheet(state, {
    id: id("5ee00000", 1),
    cycle: current,
    owner: ME,
    employee: "E-1001",
    goals: goals(1, [50, 30, 20]),
    reason: "評価シートを作成します",
  })
  run(state, s1, [
    [ME, submitGoals],
    [MANAGER, approveGoals, true],
  ])
  const s2 = createSheet(state, {
    id: id("5ee00000", 2),
    cycle: previous,
    owner: ME,
    employee: "E-1001",
    goals: goals(2, [60, 40]),
    reason: "評価シートを作成します",
  })
  run(state, s2, [
    [ME, submitGoals],
    [MANAGER, approveGoals, true],
    [
      ME,
      {
        operation: "self_evaluate",
        assessments: selfAssessments(s2, [4, 3]),
        reason: "自己評価を保存します",
      },
    ],
    [ME, submitEvaluation],
    [
      MANAGER,
      {
        operation: "decide",
        action: "approve",
        target: target(),
        assessments: s2.data.goals.map((goal, i) => ({
          goal_id: goal.id,
          score: [4, 4][i] ?? 3,
          comment: "期待どおりの成果でした。",
        })),
        reason: "評価を確定します",
      },
      true,
    ],
  ])
  createSheet(state, {
    id: id("5ee00000", 3),
    cycle: later,
    owner: ME,
    employee: "E-1001",
    goals: goals(3, [60, 40]),
    reason: "評価シートを作成します",
  })

  // 部下のシート。管理者の場面では、自分の判断を待っているものがある。
  const s4 = createSheet(state, {
    id: id("5ee00000", 4),
    cycle: current,
    owner: OTHERS[0],
    employee: "E-1002",
    goals: goals(4, [40, 40, 20]),
    reason: "評価シートを作成します",
  })
  run(state, s4, [[OTHERS[0], submitGoals]])
  s4.decider = admin
  const s5 = createSheet(state, {
    id: id("5ee00000", 5),
    cycle: current,
    owner: OTHERS[1],
    employee: "E-1003",
    goals: goals(5, [70, 30]),
    reason: "評価シートを作成します",
  })
  run(state, s5, [
    [OTHERS[1], submitGoals],
    [MANAGER, approveGoals, true],
    [
      OTHERS[1],
      {
        operation: "self_evaluate",
        assessments: selfAssessments(s5, [4, 5]),
        reason: "自己評価を保存します",
      },
    ],
    [OTHERS[1], submitEvaluation],
  ])
  s5.decider = admin
  const s6 = createSheet(state, {
    id: id("5ee00000", 6),
    cycle: current,
    owner: OTHERS[2],
    employee: "E-1004",
    goals: goals(6, [50, 50]),
    reason: "評価シートを作成します",
  })
  run(state, s6, [
    [OTHERS[2], submitGoals],
    [
      MANAGER,
      {
        operation: "decide",
        action: "return",
        target: target(),
        reason: "目標2の達成の基準を数字で書いてください。",
      },
      true,
    ],
  ])
  const s7 = createSheet(state, {
    id: id("5ee00000", 7),
    cycle: current,
    owner: OTHERS[3],
    employee: "E-1005",
    goals: goals(7, [100]),
    reason: "評価シートを作成します",
  })
  run(state, s7, [[OTHERS[3], { operation: "cancel", reason: "異動のため作り直します" }]])
  createSheet(state, {
    id: id("5ee00000", 8),
    cycle: current,
    owner: OTHERS[4],
    employee: "E-1006",
    goals: [],
    reason: "評価シートを作成します",
  })
  return state
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function page<T>(items: T[], query: URLSearchParams) {
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? 50) || 50))
  const offset = Math.max(0, Number(query.get("offset") ?? 0) || 0)
  const data = items.slice(offset, offset + limit)
  return { data, limit, offset, next_offset: offset + limit < items.length ? offset + limit : null }
}

function visible(state: State, sheet: Sheet): boolean {
  return sheet.data.owner_account_id === ME || sheet.decider || state.canReadAll
}

function cycleData({ goal_approval: _, evaluation_approval: __, ...data }: Cycle) {
  return data
}

function byUpdated(a: Sheet, b: Sheet) {
  return b.data.updated_at.localeCompare(a.data.updated_at)
}

export const area = defineMockArea<State>({
  name: "reviews",
  seed,
  handle: ({ state, path, method, query, body }) => {
    if (!path.startsWith("/performance-review/")) return null
    try {
      if (path === "/performance-review/cycles") {
        if (method === "GET") return json(page(state.cycles.map(cycleData), query))
        if (method !== "POST") return json({ error: "method_not_allowed" }, 405)
        if (!state.canManage) throw new Failure(403, "permission_required")
        const name = typeof body.name === "string" ? body.name.trim() : ""
        const startsOn = typeof body.starts_on === "string" ? body.starts_on : ""
        const endsOn = typeof body.ends_on === "string" ? body.ends_on : ""
        if (
          typeof body.id !== "string" ||
          !UUID.test(body.id) ||
          name === "" ||
          typeof body.reason !== "string" ||
          !body.reason.trim()
        )
          throw new Failure(400, "invalid_request")
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(endsOn) ||
          startsOn > endsOn
        )
          throw new Failure(422, "invalid_review_period")
        const existing = state.cycles.find((item) => item.id === body.id)
        if (existing !== undefined) return json(cycleData(existing), 201)
        const readRoute = (value: unknown): Route =>
          route(
            ((value as { steps?: Step[] } | undefined)?.steps ?? [STEP_MANAGER]).map((step) => ({
              ...step,
              rejection_behavior: step.rejection_behavior ?? "reject",
            })),
          )
        const created: Cycle = {
          ...cycle(0, name, startsOn, endsOn, time(state), []),
          id: body.id,
          goals_procedure_key: `review_${body.id.replaceAll("-", "")}_goals`,
          evaluation_procedure_key: `review_${body.id.replaceAll("-", "")}_evaluation`,
          goal_approval: readRoute(body.goal_workflow),
          evaluation_approval: readRoute(body.evaluation_workflow),
        }
        state.cycles.unshift(created)
        return json(cycleData(created), 201)
      }
      const cycleMatch = /^\/performance-review\/cycles\/([^/]+)$/.exec(path)
      if (cycleMatch !== null) {
        if (method !== "GET") return json({ error: "method_not_allowed" }, 405)
        const found = state.cycles.find((item) => item.id === cycleMatch[1])
        if (found === undefined) throw new Failure(404, "cycle_not_found")
        return json(found)
      }
      if (path === "/performance-review/sheets") {
        if (method === "GET") {
          const scope = query.get("scope") ?? "mine"
          const cycleId = query.get("cycle_id")
          const inCycle = (sheet: Sheet) => cycleId === null || sheet.data.cycle_id === cycleId
          if (scope === "all" && !state.canReadAll) throw new Failure(403, "permission_required")
          if (scope === "inbox") {
            const items = state.sheets
              .filter(
                (sheet) => sheet.decider && inCycle(sheet) && decisionTarget(state, sheet) !== null,
              )
              .map((sheet) => ({ ...sheet.data, decision_target: decisionTarget(state, sheet) }))
            return json(page(items, query))
          }
          const items = state.sheets
            .filter(
              (sheet) => inCycle(sheet) && (scope === "all" || sheet.data.owner_account_id === ME),
            )
            .sort(byUpdated)
            .map((sheet) => sheet.data)
          return json(page(items, query))
        }
        if (method !== "POST") return json({ error: "method_not_allowed" }, 405)
        if (
          typeof body.id !== "string" ||
          !UUID.test(body.id) ||
          typeof body.reason !== "string" ||
          !body.reason.trim()
        )
          throw new Failure(400, "invalid_request")
        const existing = state.sheets.find((sheet) => sheet.data.id === body.id)
        if (existing !== undefined) return json(existing.data, 201)
        const target = state.cycles.find((item) => item.id === body.cycle_id)
        if (target === undefined) throw new Failure(404, "cycle_not_found")
        const created = createSheet(state, {
          id: body.id,
          cycle: target,
          owner: ME,
          employee: "E-1001",
          goals: readGoals(body.goals, target.evaluation_policy),
          reason: body.reason.trim(),
        })
        return json(created.data, 201)
      }
      const sheetMatch = /^\/performance-review\/sheets\/([^/]+)(\/history|\/commands)?$/.exec(path)
      if (sheetMatch === null) return null
      const sheet = state.sheets.find((item) => item.data.id === sheetMatch[1])
      if (sheet === undefined || !visible(state, sheet)) throw new Failure(404, "sheet_not_found")
      if (sheetMatch[2] === undefined) {
        if (method !== "GET") return json({ error: "method_not_allowed" }, 405)
        return json({
          ...sheet.data,
          decision_target: decisionTarget(state, sheet),
          self_evaluation_summary:
            sheet.data.self_assessments.length === 0
              ? null
              : summarize(sheet.data, sheet.data.self_assessments),
        })
      }
      if (sheetMatch[2] === "/history") {
        if (method !== "GET") return json({ error: "method_not_allowed" }, 405)
        return json(page(state.history[sheet.data.id] ?? [], query))
      }
      if (method !== "POST") return json({ error: "method_not_allowed" }, 405)
      return json(apply(state, sheet, ME, body))
    } catch (error) {
      if (error instanceof Failure) return json({ error: error.code }, error.status)
      throw error
    }
  },
})
