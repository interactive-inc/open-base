import type { MockRequest, MockState, Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

type Decision = Omit<MockRequest["decisions"][number], "action"> & {
  action: "approve" | "reject" | "return"
}

/** 申請の一件。差し戻しの判断も持てるよう、全体の申請より判断の種類が広い。 */
export type ApplicationRequest = Omit<MockRequest, "decisions"> & { decisions: Decision[] }

type Approver =
  | { type: "employee"; employee_code: string }
  | { type: "direct_manager" | "department_manager" | "target_department_manager" }
  | { type: "management_chain" }
  | { type: "responsibility"; responsibility_type: string; organization_unit_code: string | null }

type WorkflowStep = {
  key: string
  name: string
  approvers: Approver[]
  approval_mode: "any" | "all" | "minimum"
  minimum_approvals?: number
  condition_mode: "all" | "any"
  conditions: unknown[]
  due_days: number | null
  escalation_approvers: Approver[]
  rejection_behavior: "reject" | "return"
  allow_delegation: boolean
}

type TemplateWorkflow = {
  workflow: { version: 1; steps: WorkflowStep[] }
  revision: number
  updated_at: string
}

type Party = { id: string; code: string; name: string }

type Delegation = {
  id: number
  delegator: Party
  delegate: Party
  template_code: string | null
  starts_at: string
  ends_at: string
  cancelled_at: string | null
  created_at: string
}

type Repair = {
  id: number
  template_code: string
  template_name: string
  applicant_name: string | null
  step_key: string
  round: number
  reason: "snapshot_missing" | "inactive_candidates"
  started_at: string
}

/** この領域の架空の状態。テンプレートと申請の本体は全体の状態にあり、ここは足りない分だけを持つ。 */
export type State = {
  /** 差し戻し中やワークフローの無い申請など、全体の初期値に無い例。 */
  requests: ApplicationRequest[]
  /** テンプレートのコードごとの承認ワークフロー。無いテンプレートは載せない。 */
  workflows: Record<string, TemplateWorkflow>
  /** テンプレートのコードごとの、ワークフローが無いときに承認する役割。 */
  approverRoles: Record<string, string[]>
  delegations: Delegation[]
  repairs: Repair[]
}

const at = (day: number, hour = 1) => new Date(Date.UTC(2026, 10, day, hour)).toISOString()

const SELF: Party = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "E0001",
  name: "Example Administrator",
}

const json = (body: unknown, status = 200) => Response.json(body, { status })
const fail = (status: number, error: string, code?: string) =>
  json(code === undefined ? { error } : { error, code }, status)

function step(key: string, name: string, approvers: Approver[], rejection: "reject" | "return") {
  return {
    key,
    name,
    approvers,
    approval_mode: "any",
    condition_mode: "all",
    conditions: [],
    due_days: 3,
    escalation_approvers: [],
    rejection_behavior: rejection,
    allow_delegation: true,
  } satisfies WorkflowStep
}

function seed(scenario: Scenario): State {
  if (scenario === "empty") {
    return { requests: [], workflows: {}, approverRoles: {}, delegations: [], repairs: [] }
  }
  return {
    requests: [
      {
        id: 105,
        templateCode: "leave",
        applicantName: SELF.name,
        mine: true,
        canDecide: false,
        status: "pending",
        payload: { date: "2026-11-02", kind: "有給休暇", reason: "私用のため" },
        createdAt: at(5),
        steps: [
          { key: "manager", name: "上長", status: "returned" },
          { key: "people", name: "人事", status: "waiting" },
        ],
        decisions: [
          {
            id: 3,
            step_key: "manager",
            approver_name: "Example Manager",
            action: "return",
            comment: "休む日が過ぎています。日付を直してください。",
            created_at: at(6),
          },
        ],
      },
      {
        id: 106,
        templateCode: "purchase",
        applicantName: SELF.name,
        mine: true,
        canDecide: false,
        status: "pending",
        payload: { item: "キーボード", amount: 9800 },
        createdAt: at(13),
        steps: [],
        decisions: [],
      },
    ],
    workflows: {
      leave: {
        workflow: {
          version: 1,
          steps: [
            step("manager", "上長", [{ type: "direct_manager" }], "return"),
            step(
              "people",
              "人事",
              [
                {
                  type: "responsibility",
                  responsibility_type: "PEOPLE_MANAGER",
                  organization_unit_code: null,
                },
              ],
              "reject",
            ),
          ],
        },
        revision: 1,
        updated_at: at(1),
      },
    },
    approverRoles: { purchase: ["manager"] },
    delegations: [
      {
        id: 1,
        delegator: SELF,
        delegate: {
          id: "00000000-0000-4000-8000-000000000002",
          code: "E0002",
          name: "Example Member",
        },
        template_code: null,
        starts_at: at(10),
        ends_at: new Date(Date.UTC(2026, 11, 31, 9)).toISOString(),
        cancelled_at: null,
        created_at: at(9),
      },
      {
        id: 2,
        delegator: {
          id: "00000000-0000-4000-8000-000000000003",
          code: "E0003",
          name: "Example Manager",
        },
        delegate: SELF,
        template_code: "leave",
        starts_at: at(1),
        ends_at: at(5),
        cancelled_at: null,
        created_at: at(1),
      },
    ],
    repairs: [
      {
        id: 102,
        template_code: "purchase",
        template_name: "備品の購入",
        applicant_name: "とても長い名前の申請者 Example Applicant",
        step_key: "manager",
        round: 1,
        reason: "inactive_candidates",
        started_at: at(12),
      },
    ],
  }
}

/** 管理の権限が要る経路。メンバーの場面では断る。 */
function forbidden(scenario: Scenario): Response | null {
  return scenario === "member" ? fail(403, "この操作をする権限がありません", "forbidden") : null
}

function readWorkflowBody(body: Record<string, unknown>): TemplateWorkflow["workflow"] | null {
  const steps = body.steps
  if (body.version !== 1 || !Array.isArray(steps) || steps.length === 0 || steps.length > 20) {
    return null
  }
  const keys = new Set<string>()
  for (const item of steps as Array<Record<string, unknown>>) {
    if (typeof item.key !== "string" || typeof item.name !== "string" || keys.has(item.key)) {
      return null
    }
    if (!Array.isArray(item.approvers) || item.approvers.length === 0) return null
    keys.add(item.key)
  }
  return {
    version: 1,
    steps: (steps as Array<Partial<WorkflowStep>>).map((item) => ({
      condition_mode: "all",
      conditions: [],
      escalation_approvers: [],
      due_days: null,
      approval_mode: "any",
      rejection_behavior: "reject",
      allow_delegation: true,
      ...item,
    })) as WorkflowStep[],
  }
}

const STATUSES = ["pending", "approved", "rejected"] as const

/** 全社の一覧と部署の一覧。部署は `dev` だけを架空の部署として持つ。 */
function listApplications(input: {
  state: State
  root: MockState
  path: string
  query: URLSearchParams
}): Response {
  const { state, root, query } = input
  const department = input.path === "/company/application-requests"
  if (department) {
    if (query.get("scope") !== "department") return fail(403, "この一覧は読めません", "forbidden")
    if (!query.get("department_code")) return fail(422, "部署のコードが要ります")
  }
  const denied = forbidden(root.scenario)
  if (denied !== null) return denied
  const status = STATUSES.find((value) => value === query.get("status")) ?? null
  const template = department ? null : query.get("template_code") || null
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? "50") || 50))
  const offset = Math.max(0, Number(query.get("offset") ?? "0") || 0)
  const items: ApplicationRequest[] = [...root.requests, ...state.requests]
  const matched = items
    .filter((item) => !department || query.get("department_code") === "dev")
    .filter((item) => status === null || item.status === status)
    .filter((item) => template === null || item.templateCode === template)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return json({
    data: matched.slice(offset, offset + limit).map((item) => {
      const returned = item.steps.find((step) => step.status === "returned")
      return {
        id: item.id,
        template_code: item.templateCode,
        template_name:
          root.templates.find((candidate) => candidate.code === item.templateCode)?.name ??
          item.templateCode,
        template_category:
          root.templates.find((candidate) => candidate.code === item.templateCode)?.category ?? "",
        applicant_id: item.mine ? SELF.id : "00000000-0000-4000-8000-000000000009",
        applicant_name: item.applicantName,
        applicant_dept_name: "開発部",
        current_step:
          returned !== undefined
            ? `returned:${returned.key}`
            : (item.steps.find((step) => step.status === "pending")?.key ?? null),
        status: item.status,
        created_at: item.createdAt,
      }
    }),
    total: matched.length,
  })
}

export const area = defineMockArea<State>({
  name: "applications",
  seed,
  handle: ({ state, root, path, method, query, body }) => {
    // 保存済みの古い状態には領域の値が無いことがある。足りない分を空で補う。
    state.requests ??= []
    state.workflows ??= {}
    state.approverRoles ??= {}
    state.delegations ??= []
    state.repairs ??= []

    if (
      (path === "/company/application-requests/admin" ||
        path === "/company/application-requests") &&
      method === "GET"
    ) {
      return listApplications({ state, root, path, query })
    }

    const workflow = /^\/company\/application-templates\/([^/]+)\/workflow$/.exec(path)
    if (workflow !== null) {
      const denied = forbidden(root.scenario)
      if (denied !== null) return denied
      const code = decodeURIComponent(workflow[1] ?? "")
      if (!root.templates.some((template) => template.code === code)) {
        return fail(404, "見つかりません", "not_found")
      }
      const current = state.workflows[code]
      if (method === "GET") {
        return json(current ?? { workflow: null, revision: null, updated_at: null })
      }
      if (method !== "PUT") return fail(405, "このモックでは扱いません")
      if (body.expected_revision !== (current?.revision ?? 0)) {
        return fail(409, "ほかの人が先に更新しました", "workflow_revision_conflict")
      }
      const next = readWorkflowBody(body)
      if (next === null) return fail(400, "入力を確認してください")
      state.workflows[code] = {
        workflow: next,
        revision: (current?.revision ?? 0) + 1,
        updated_at: new Date(Date.UTC(2026, 10, 14, 3)).toISOString(),
      }
      return json(state.workflows[code])
    }

    if (path === "/company/approval-delegations") {
      if (method === "GET") {
        return json({
          data: state.delegations.map((item) => ({
            ...item,
            can_delete: item.delegator.code === SELF.code && item.cancelled_at === null,
          })),
        })
      }
      if (method !== "POST") return fail(405, "このモックでは扱いません")
      const code =
        typeof body.delegate_employee_code === "string" ? body.delegate_employee_code : ""
      const starts = new Date(String(body.starts_at))
      const ends = new Date(String(body.ends_at))
      if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
        return fail(400, "期間を確認してください")
      }
      if (code === SELF.code) return fail(400, "自分には頼めません")
      if (!/^E\d{4}$/.test(code)) return fail(404, "従業員が見つかりません", "not_found")
      const template = typeof body.template_code === "string" ? body.template_code : null
      const overlaps = state.delegations.some(
        (item) =>
          item.delegator.code === SELF.code &&
          item.cancelled_at === null &&
          (item.template_code === null || template === null || item.template_code === template) &&
          new Date(item.starts_at) < ends &&
          starts < new Date(item.ends_at),
      )
      if (overlaps) return fail(409, "期間が重なっています", "delegation_overlap")
      const created: Delegation = {
        id: Math.max(0, ...state.delegations.map((item) => item.id)) + 1,
        delegator: SELF,
        delegate: {
          id: `00000000-0000-4000-8000-00000000${code.slice(1)}`,
          code,
          name: `Example Employee ${code}`,
        },
        template_code: template,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        cancelled_at: null,
        created_at: new Date(Date.UTC(2026, 10, 14, 3)).toISOString(),
      }
      state.delegations.push(created)
      return json(
        {
          id: created.id,
          delegate_employee_code: code,
          template_code: created.template_code,
          starts_at: created.starts_at,
          ends_at: created.ends_at,
          created_at: created.created_at,
        },
        201,
      )
    }

    const delegation = /^\/company\/approval-delegations\/(\d+)$/.exec(path)
    if (delegation !== null) {
      if (method !== "DELETE") return fail(405, "このモックでは扱いません")
      const item = state.delegations.find(
        (candidate) =>
          candidate.id === Number(delegation[1]) &&
          candidate.delegator.code === SELF.code &&
          candidate.cancelled_at === null,
      )
      if (item === undefined) return fail(404, "見つかりません", "not_found")
      item.cancelled_at = new Date(Date.UTC(2026, 10, 14, 3)).toISOString()
      return new Response(null, { status: 204 })
    }

    if (path === "/company/application-requests/workflow-repairs" && method === "GET") {
      const denied = forbidden(root.scenario)
      if (denied !== null) return denied
      return json({ data: state.repairs, total: state.repairs.length })
    }

    const reassign = /^\/company\/application-requests\/(\d+)\/reassign-workflow-step$/.exec(path)
    if (reassign !== null) {
      if (method !== "POST") return fail(405, "このモックでは扱いません")
      const denied = forbidden(root.scenario)
      if (denied !== null) return denied
      const repair = state.repairs.find((item) => item.id === Number(reassign[1]))
      if (repair === undefined) return fail(409, "付け替えられる段階がありません", "conflict")
      const ids = body.candidate_employee_ids
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 20 || reason === "") {
        return fail(400, "入力を確認してください")
      }
      state.repairs = state.repairs.filter((item) => item !== repair)
      return json({
        status: "pending",
        step_key: repair.step_key,
        round: repair.round + 1,
        candidate_employee_ids: ids,
      })
    }

    return null
  },
})
