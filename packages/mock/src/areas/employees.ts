import { HttpResponse } from "msw/http"
import type { Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

/** モックの会社の今日。基準日と予定の判定をこの日で固定する。 */
const TODAY = "2026-11-14"

type Unit = { id: string; code: string; name: string }
type AssignmentType = "primary" | "concurrent"

/** 発令の要約。本物のAPIの `summary` と同じ形。 */
type Summary = {
  kind: string
  eventOn: string
  department?: { code: string; name: string } | null
  assignmentType?: AssignmentType
  positionTitle?: string | null
  previousPositionTitle?: string | null
  managerEmployeeCode?: string | null
  previousManagerEmployeeCode?: string | null
  status?: "active" | "leave" | "retired"
  employmentType?: "FULL_TIME" | "PART_TIME"
  changeType?: "promotion" | "demotion" | "lateral" | "other"
  correctsActionId?: string
  replacementKind?: string
  replacementEventOn?: string
}

/** 発令の一件。`effect` は状態へ効く内容で、訂正の発令では置き換え後の内容を持つ。 */
type MockAction = {
  id: string
  employeeId: string
  kind: string
  eventOn: string
  recordedAt: string
  sourceType: "application" | "direct" | "system"
  sourceApplicationId: number | null
  correctsActionId: string | null
  summary: Summary
  effect: Summary
}

type MockEmployee = {
  id: string
  code: string
  name: string
  email: string
  phone: string | null
  personRevision: number
  revision: number
}

type MockRequest = {
  id: string
  applicationId: number | null
  targetCode: string
  requesterCode: string | null
  kind: string
  status: "pending" | "approved" | "rejected" | "withdrawn"
  currentStep: string | null
  createdAt: string
  appliedActionId: string | null
}

/** この領域の架空の状態。 */
export type State = {
  companyRevision: number
  organizationRevision: number
  units: Unit[]
  positions: Record<string, string>
  employees: MockEmployee[]
  actions: MockAction[]
  requests: MockRequest[]
  sequence: number
}

type Assignment = {
  periodId: string
  unit: Unit
  type: AssignmentType
  positionTitle: string | null
  managerCode: string | null
  startsOn: string
}

type Snapshot = {
  status: "prehire" | "active" | "leave" | "retired"
  primary: Assignment | null
  concurrent: Assignment[]
  responsibilities: string[]
}

const UNITS: Unit[] = [
  { id: "unit-admin", code: "ADMIN", name: "管理部" },
  { id: "unit-dev", code: "DEV", name: "開発部" },
  { id: "unit-sales", code: "SALES", name: "営業部" },
  { id: "unit-new-biz", code: "NEW-BIZ", name: "とても長い名前の新規事業推進準備室" },
]

const POSITIONS: Record<string, string> = {
  "P-HEAD": "部長",
  "P-LEAD": "主任",
  "P-STAFF": "担当",
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
}

function unit(code: string): Unit {
  return UNITS.find((item) => item.code === code) ?? UNITS[0]!
}

function department(code: string) {
  const found = unit(code)
  return { code: found.code, name: found.name }
}

/** 架空の従業員と、その人事の流れを作る。 */
function seedState(scenario: Scenario): State {
  const state: State = {
    companyRevision: 42,
    organizationRevision: 7,
    units: UNITS,
    positions: POSITIONS,
    employees: [],
    actions: [],
    requests: [],
    sequence: 0,
  }
  if (scenario === "empty") return state

  const people: Array<[string, string, string | null]> = [
    ["E0001", "Example Administrator", "000-0000-0001"],
    ["E0002", "Example Manager", null],
    ["E0003", "Example Engineer", null],
    ["E0004", "Example Sales", null],
    ["E0005", "Example Retiree", null],
    ["E0006", "Example Person With A Considerably Long Display Name", null],
    ["E0007", "Example Corrected", null],
    ["E0008", "Example Member", "000-0000-0008"],
  ]
  for (const [code, name, phone] of people)
    state.employees.push({
      id: `employee-${code.toLowerCase()}`,
      code,
      name,
      email: `${code.toLowerCase()}@example.com`,
      phone,
      personRevision: 1,
      revision: 1,
    })

  const add = (
    code: string,
    summary: Summary,
    options: { source?: MockAction["sourceType"]; application?: number } = {},
  ) => {
    state.sequence += 1
    const action: MockAction = {
      id: uuid(state.sequence),
      employeeId: `employee-${code.toLowerCase()}`,
      kind: summary.kind,
      eventOn: summary.eventOn,
      recordedAt: new Date(Date.UTC(2026, 0, 1) + state.sequence * 86_400_000).toISOString(),
      sourceType: options.source ?? "direct",
      sourceApplicationId: options.application ?? null,
      correctsActionId: null,
      summary,
      effect: summary,
    }
    state.actions.push(action)
    return action
  }
  const hire = (
    code: string,
    eventOn: string,
    dept: string,
    title: string,
    manager: string | null,
  ) =>
    add(code, {
      kind: "hire",
      employmentType: "FULL_TIME",
      eventOn,
      department: department(dept),
      positionTitle: title,
      managerEmployeeCode: manager,
      status: "active",
    })

  hire("E0001", "2015-04-01", "ADMIN", "部長", null)
  add("E0001", {
    kind: "department_responsibility_started",
    eventOn: "2020-04-01",
    department: department("ADMIN"),
  })
  hire("E0002", "2016-04-01", "DEV", "主任", "E0001")
  add("E0002", {
    kind: "position_changed",
    eventOn: "2022-04-01",
    department: department("DEV"),
    assignmentType: "primary",
    previousPositionTitle: "主任",
    positionTitle: "部長",
    changeType: "promotion",
  })
  hire("E0003", "2018-04-01", "SALES", "担当", "E0001")
  add("E0003", {
    kind: "transferred",
    eventOn: "2021-10-01",
    department: department("DEV"),
    assignmentType: "primary",
    positionTitle: "担当",
    managerEmployeeCode: "E0002",
  })
  add(
    "E0003",
    {
      kind: "position_changed",
      eventOn: "2024-04-01",
      department: department("DEV"),
      assignmentType: "primary",
      previousPositionTitle: "担当",
      positionTitle: "主任",
      changeType: "promotion",
    },
    { source: "application", application: 101 },
  )
  add("E0003", {
    kind: "transferred",
    eventOn: "2026-12-01",
    department: department("NEW-BIZ"),
    assignmentType: "primary",
    positionTitle: "主任",
    managerEmployeeCode: "E0001",
  })
  hire("E0004", "2019-04-01", "SALES", "担当", "E0001")
  add("E0004", { kind: "leave_started", eventOn: "2026-09-01", status: "leave" })
  hire("E0005", "2010-04-01", "SALES", "担当", "E0001")
  add("E0005", { kind: "retired", eventOn: "2025-03-31", status: "retired" })
  hire("E0006", "2023-10-01", "NEW-BIZ", "担当", "E0001")
  add("E0006", {
    kind: "concurrent_assignment_started",
    eventOn: "2025-04-01",
    department: department("DEV"),
    assignmentType: "concurrent",
    positionTitle: null,
    managerEmployeeCode: "E0002",
  })
  hire("E0007", "2023-04-01", "DEV", "担当", "E0002")
  const wrong = add("E0007", {
    kind: "transferred",
    eventOn: "2024-10-01",
    department: department("SALES"),
    assignmentType: "primary",
    positionTitle: "担当",
    managerEmployeeCode: "E0001",
  })
  correct(state, wrong, {
    kind: "transferred",
    eventOn: "2024-10-01",
    department: department("NEW-BIZ"),
    assignmentType: "primary",
    positionTitle: "担当",
    managerEmployeeCode: "E0001",
  })
  hire("E0008", "2024-04-01", "DEV", "担当", "E0002")

  state.requests.push(
    {
      id: "request-1",
      applicationId: null,
      targetCode: "E0004",
      requesterCode: "E0001",
      kind: "returned",
      status: "pending",
      currentStep: "人事",
      createdAt: "2026-11-10T01:00:00.000Z",
      appliedActionId: null,
    },
    {
      id: "request-2",
      applicationId: null,
      targetCode: "E0003",
      requesterCode: "E0002",
      kind: "position_changed",
      status: "approved",
      currentStep: null,
      createdAt: "2024-03-01T01:00:00.000Z",
      appliedActionId: uuid(7),
    },
    {
      id: "request-3",
      applicationId: null,
      targetCode: "E0008",
      requesterCode: "E0002",
      kind: "transferred",
      status: "rejected",
      currentStep: null,
      createdAt: "2026-10-01T01:00:00.000Z",
      appliedActionId: null,
    },
  )
  return state
}

/** 元の発令を訂正する発令を足す。訂正の発令は置き換え後の内容を `effect` に持つ。 */
function correct(
  state: State,
  original: MockAction,
  replacement: Summary,
  source: MockAction["sourceType"] = "direct",
) {
  state.sequence += 1
  const action: MockAction = {
    id: uuid(state.sequence),
    employeeId: original.employeeId,
    kind: "corrected",
    eventOn: replacement.eventOn,
    recordedAt: new Date(Date.UTC(2026, 0, 1) + state.sequence * 86_400_000).toISOString(),
    sourceType: source,
    sourceApplicationId: null,
    correctsActionId: original.id,
    summary: {
      kind: "corrected",
      eventOn: replacement.eventOn,
      correctsActionId: original.id,
      replacementKind: replacement.kind,
      replacementEventOn: replacement.eventOn,
    },
    effect: replacement,
  }
  state.actions.push(action)
  return action
}

function correctedIds(state: State): Set<string> {
  return new Set(
    state.actions.flatMap((action) =>
      action.correctsActionId === null ? [] : [action.correctsActionId],
    ),
  )
}

/** 基準日までの有効な発令を日付の順に当てはめ、その日の人事状態を作る。 */
function snapshot(state: State, employee: MockEmployee, asOf: string): Snapshot {
  const corrected = correctedIds(state)
  const effective = state.actions
    .filter(
      (action) =>
        action.employeeId === employee.id &&
        !corrected.has(action.id) &&
        action.effect.eventOn <= asOf,
    )
    .sort(
      (a, b) =>
        a.effect.eventOn.localeCompare(b.effect.eventOn) ||
        a.recordedAt.localeCompare(b.recordedAt),
    )
  const result: Snapshot = {
    status: "prehire",
    primary: null,
    concurrent: [],
    responsibilities: [],
  }
  for (const action of effective) {
    const effect = action.effect
    const assignment = (type: AssignmentType): Assignment | null =>
      effect.department
        ? {
            periodId: `${action.id}-${type}`,
            unit: unit(effect.department.code),
            type,
            positionTitle: effect.positionTitle ?? null,
            managerCode: effect.managerEmployeeCode ?? null,
            startsOn: effect.eventOn,
          }
        : null
    const target = (): Assignment | undefined =>
      effect.assignmentType === "concurrent"
        ? result.concurrent.find((item) => item.unit.code === effect.department?.code)
        : (result.primary ?? undefined)
    switch (effect.kind) {
      case "hire":
      case "rehire":
        result.status = "active"
        result.primary = assignment("primary")
        result.concurrent = []
        break
      case "primary_assignment_started":
      case "transferred":
        result.primary = assignment("primary")
        break
      case "concurrent_assignment_started": {
        const added = assignment("concurrent")
        if (added) result.concurrent.push(added)
        break
      }
      case "assignment_ended":
        if (effect.assignmentType === "concurrent")
          result.concurrent = result.concurrent.filter(
            (item) => item.unit.code !== effect.department?.code,
          )
        else result.primary = null
        break
      case "position_changed": {
        const found = target()
        if (found) found.positionTitle = effect.positionTitle ?? null
        break
      }
      case "manager_changed": {
        const found = target()
        if (found) found.managerCode = effect.managerEmployeeCode ?? null
        break
      }
      case "department_responsibility_started":
        if (effect.department) result.responsibilities.push(effect.department.code)
        break
      case "department_responsibility_ended":
        result.responsibilities = result.responsibilities.filter(
          (code) => code !== effect.department?.code,
        )
        break
      case "leave_started":
        result.status = "leave"
        break
      case "returned":
        result.status = "active"
        break
      case "retired":
        result.status = "retired"
        result.primary = null
        result.concurrent = []
        result.responsibilities = []
        break
    }
  }
  return result
}

function json(body: unknown, status = 200) {
  return HttpResponse.json(body as Record<string, unknown>, { status })
}

function failure(status: number, code: string, error: string) {
  return HttpResponse.json({ code, error }, { status })
}

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null
}

/** 本人として扱う従業員。全体のprofileの名前と同じ人。 */
function me(state: State, name: string): MockEmployee | undefined {
  return state.employees.find((employee) => employee.name === name)
}

function profileVersion(state: State, employee: MockEmployee) {
  return {
    employeeId: employee.id,
    organizationRevision: state.companyRevision,
    personRevision: employee.personRevision,
    effectiveOn: TODAY,
  }
}

function assignmentResponse(assignment: Assignment) {
  return {
    period_id: assignment.periodId,
    employment_period_id: "employment-1",
    department_code: assignment.unit.code,
    department_name: assignment.unit.name,
    assignment_type: assignment.type,
    position_title: assignment.positionTitle,
    manager_employee_code: assignment.managerCode,
    manager_employee_codes: assignment.managerCode === null ? [] : [assignment.managerCode],
    manager_employee_ids:
      assignment.managerCode === null ? [] : [`employee-${assignment.managerCode.toLowerCase()}`],
    starts_on: assignment.startsOn,
    ends_on: null,
  }
}

function directoryEntry(state: State, employee: MockEmployee) {
  const now = snapshot(state, employee, TODAY)
  return {
    id: employee.id,
    code: employee.code,
    name: employee.name,
    email: employee.email,
    status: now.status === "prehire" ? ("inactive" as const) : now.status,
    organization_unit_id: now.primary?.unit.id ?? null,
    organization_unit_code: now.primary?.unit.code ?? null,
    organization_unit_name: now.primary?.unit.name ?? null,
    position: now.primary?.positionTitle ?? null,
  }
}

/** 画面から届いた発令の入力を、要約の形にする。読めない入力はエラーの文を返す。 */
function summarize(state: State, input: Record<string, unknown>): Summary | string {
  const kind = text(input.kind)
  const eventOn = kind === "retired" ? input.retirementOn : input.eventOn
  if (kind === null || !isDate(eventOn)) return "発令の種類と日付を確かめてください"
  const deptCode = text(input.departmentCode)
  if (deptCode !== null && !state.units.some((item) => item.code === deptCode))
    return "部署のコードが見つかりません"
  const positionCode = text(input.positionCode)
  if (positionCode !== null && state.positions[positionCode] === undefined)
    return "指定した会社版と日付の役職コードを一意に解決できません"
  const positionTitle = positionCode === null ? null : (state.positions[positionCode] ?? null)
  const manager = text(input.managerEmployeeCode)
  const dept = deptCode === null ? null : department(deptCode)
  const assignmentType = input.assignmentType === "concurrent" ? "concurrent" : "primary"
  switch (kind) {
    case "rehire":
      return {
        kind,
        eventOn,
        employmentType: input.employmentType === "PART_TIME" ? "PART_TIME" : "FULL_TIME",
        department: dept,
        positionTitle,
        managerEmployeeCode: manager,
        status: "active",
      }
    case "primary_assignment_started":
    case "transferred":
    case "concurrent_assignment_started":
      if (dept === null) return "部署が必要です"
      return {
        kind,
        eventOn,
        department: dept,
        assignmentType: kind === "concurrent_assignment_started" ? "concurrent" : "primary",
        positionTitle,
        managerEmployeeCode: manager,
      }
    case "assignment_ended":
      if (dept === null) return "部署が必要です"
      return { kind, eventOn, department: dept, assignmentType }
    case "position_changed":
      if (dept === null || positionTitle === null) return "部署と役職が必要です"
      return {
        kind,
        eventOn,
        department: dept,
        assignmentType,
        previousPositionTitle: null,
        positionTitle,
        changeType:
          input.changeType === "demotion" ||
          input.changeType === "lateral" ||
          input.changeType === "other"
            ? input.changeType
            : "promotion",
      }
    case "manager_changed":
      if (dept === null) return "部署が必要です"
      return {
        kind,
        eventOn,
        department: dept,
        assignmentType,
        previousManagerEmployeeCode: null,
        managerEmployeeCode: manager,
      }
    case "department_responsibility_started":
    case "department_responsibility_ended":
      if (dept === null) return "部署が必要です"
      return { kind, eventOn, department: dept }
    case "leave_started":
      return { kind, eventOn, status: "leave" }
    case "returned":
      return { kind, eventOn, status: "active" }
    case "retired":
      return { kind, eventOn, status: "retired" }
    default:
      return "この種類の発令はモックで扱いません"
  }
}

function lifecycleEvents(state: State, employee: MockEmployee) {
  const corrected = correctedIds(state)
  return state.actions
    .filter((action) => action.employeeId === employee.id)
    .sort(
      (a, b) =>
        b.eventOn.localeCompare(a.eventOn) ||
        b.recordedAt.localeCompare(a.recordedAt) ||
        b.id.localeCompare(a.id),
    )
    .map((action) => ({
      id: action.id,
      kind: action.kind,
      event_on: action.eventOn,
      recorded_at: action.recordedAt,
      source_type: action.sourceType,
      source_application_id: action.sourceApplicationId,
      corrects_action_id: action.correctsActionId,
      display_status:
        action.kind === "corrected"
          ? "correction"
          : corrected.has(action.id)
            ? "corrected"
            : action.eventOn > TODAY
              ? "scheduled"
              : "confirmed",
      summary: action.summary,
    }))
}

/** 件数で区切る簡単なカーソル。本物のカーソルの形は画面が読まない。 */
function page<T>(items: T[], query: URLSearchParams, fallback: number) {
  const limit = Math.min(100, Math.max(1, Number(query.get("limit") ?? fallback) || fallback))
  const offset = Math.max(0, Number(query.get("cursor") ?? "0") || 0)
  const data = items.slice(offset, offset + limit)
  return { data, next_cursor: offset + limit < items.length ? String(offset + limit) : null }
}

export const area = defineMockArea<State>({
  name: "employees",
  seed: seedState,
  handle: ({ state, root, path, method, query, body }) => {
    const admin = root.scenario !== "member"
    const self = me(state, root.profile.name)
    const findEmployee = (code: string) =>
      state.employees.find((employee) => employee.code === decodeURIComponent(code))
    const canRead = (employee: MockEmployee | undefined) => admin || employee === self

    if (path === "/company/employee-directory" && method === "GET") {
      if (!admin) return failure(403, "forbidden", "従業員名簿を読む権限がありません")
      const q = (query.get("q") ?? "").toLowerCase()
      const unitFilter = query.get("organization_unit")
      const status = query.get("status")
      const rows = state.employees
        .map((employee) => directoryEntry(state, employee))
        .filter(
          (row) =>
            (q === "" ||
              [row.name, row.code, row.email].some((value) => value.toLowerCase().includes(q))) &&
            (unitFilter === null ||
              row.organization_unit_code === unitFilter ||
              row.organization_unit_name === unitFilter) &&
            (status === null || row.status === status),
        )
      const limit = Number(query.get("limit") ?? "50") || 50
      const offset = Number(query.get("offset") ?? "0") || 0
      return json({ data: rows.slice(offset, offset + limit), total: rows.length })
    }

    const directory = /^\/company\/employee-directory\/([^/]+)$/.exec(path)
    if (directory !== null) {
      const employee = findEmployee(directory[1] ?? "")
      if (!canRead(employee)) return failure(403, "forbidden", "従業員を読む権限がありません")
      if (employee === undefined) return failure(404, "employee_not_found", "見つかりません")
      if (method === "GET") {
        const row = directoryEntry(state, employee)
        return json({
          code: employee.code,
          name: employee.name,
          profile: profileVersion(state, employee),
          dept_name: row.organization_unit_name,
          position: row.position,
          email: employee.email,
          status: row.status === "inactive" ? "active" : row.status,
        })
      }
      if (method === "PUT") {
        if (!admin) return failure(403, "forbidden", "氏名を変える権限がありません")
        const name = text(body.name)
        const profile = body.profile as { personRevision?: unknown } | undefined
        if (name === null || text(body.reason) === null)
          return failure(400, "invalid_body", "入力を確認してください")
        if (profile?.personRevision !== employee.personRevision)
          return failure(409, "conflict", "ほかの人が先に更新しました")
        employee.name = name
        employee.personRevision += 1
        state.companyRevision += 1
        return json({
          code: employee.code,
          name,
          profile: profileVersion(state, employee),
          replayed: false,
        })
      }
      return null
    }

    const lifecycle = /^\/company\/employee-lifecycle\/([^/]+)\/(state|events)$/.exec(path)
    if (lifecycle !== null && method === "GET") {
      const employee = findEmployee(lifecycle[1] ?? "")
      if (!canRead(employee)) return failure(403, "forbidden", "人事を読む権限がありません")
      if (employee === undefined) return failure(404, "employee_not_found", "見つかりません")
      if (lifecycle[2] === "events") return json(page(lifecycleEvents(state, employee), query, 25))
      const asOf = query.get("as_of") ?? TODAY
      if (!isDate(asOf)) return failure(400, "invalid_query", "as_of が不正です")
      const at = snapshot(state, employee, asOf)
      return json({
        employee_code: employee.code,
        as_of: asOf,
        status: at.status,
        employment_period_id: at.status === "prehire" ? null : "employment-1",
        primary_assignment: at.primary === null ? null : assignmentResponse(at.primary),
        concurrent_assignments: at.concurrent.map(assignmentResponse),
        responsibility_department_codes: at.responsibilities,
        employee_revision: employee.revision,
        organization_revision: state.organizationRevision,
      })
    }

    if (path === "/company/personnel-actions" && method === "GET") {
      if (!admin) return failure(403, "forbidden", "人事発令を読む権限がありません")
      const corrected = new Map(
        state.actions.flatMap((action) =>
          action.correctsActionId === null ? [] : [[action.correctsActionId, action.id] as const],
        ),
      )
      const id = query.get("id")
      const rows = state.actions
        .filter((action) => id === null || action.id === id)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
        .map((action) => {
          const employee = state.employees.find((item) => item.id === action.employeeId)
          return {
            id: action.id,
            employee_id: action.employeeId,
            kind: action.kind,
            current_employee:
              employee === undefined ? null : { code: employee.code, name: employee.name },
            event_on: action.eventOn,
            recorded_at: action.recordedAt,
            recorded_by_account_id: "example-account",
            requested_by_employee_id: null,
            source_type: action.sourceType,
            source_application_id: action.sourceApplicationId,
            corrects_action_id: action.correctsActionId,
            corrected_by_action_id: corrected.get(action.id) ?? null,
            summary: action.summary,
          }
        })
      return json(page(rows, query, 25))
    }

    if (path === "/company/personnel-action-requests" && method === "GET") {
      const status = query.get("status")
      const nameOf = (code: string | null) =>
        state.employees.find((employee) => employee.code === code)?.name ?? null
      const requests = state.requests
        .filter((request) => admin || request.requesterCode === self?.code)
        .filter((request) => status === null || request.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((request) => ({
          id: request.id,
          application_id: request.applicationId,
          target_employee_code: request.targetCode,
          target_employee_name: nameOf(request.targetCode),
          requested_by_employee_code: request.requesterCode,
          requested_by_employee_name: nameOf(request.requesterCode),
          kind: request.kind,
          status: request.status,
          current_step: request.currentStep,
          created_at: request.createdAt,
          applied_action_id: request.appliedActionId,
          withdrawn_at: null,
        }))
      return json({ requests })
    }

    if (
      (path === "/company/personnel-action-requests" ||
        path === "/company/personnel-action-executions") &&
      method === "POST"
    ) {
      const execute = path.endsWith("executions")
      if (!admin) return failure(403, "forbidden", "この操作をする権限がありません")
      const action = (body.action ?? {}) as Record<string, unknown>
      const replacement =
        action.kind === "corrected"
          ? ((action.replacementAction ?? {}) as Record<string, unknown>)
          : action
      const employee = findEmployee(text(replacement.employeeCode) ?? "")
      if (employee === undefined) return failure(404, "employee_not_found", "見つかりません")
      const companyRevision = execute ? body.expected_company_revision : body.base_company_revision
      const employeeRevision = execute
        ? body.expected_employee_revision
        : body.base_employee_revision
      if (companyRevision !== state.companyRevision || employeeRevision !== employee.revision)
        return failure(409, "personnel_action_stale", "人事情報が更新されています")
      const summary = summarize(state, replacement)
      if (typeof summary === "string")
        return failure(400, "personnel_action_invalid_transition", summary)
      let original: MockAction | undefined
      if (action.kind === "corrected") {
        original = state.actions.find((item) => item.id === action.correctsActionId)
        if (original === undefined || original.employeeId !== employee.id)
          return failure(404, "personnel_action_not_found", "訂正する発令が見つかりません")
        if (correctedIds(state).has(original.id) || original.kind === "corrected")
          return failure(409, "personnel_action_already_corrected", "もう訂正されています")
        if (text(action.reason) === null)
          return failure(400, "invalid_body", "訂正の理由が必要です")
      }
      if (!execute) {
        state.sequence += 1
        const request: MockRequest = {
          id: `request-${state.sequence}`,
          applicationId: null,
          targetCode: employee.code,
          requesterCode: self?.code ?? null,
          kind: original === undefined ? summary.kind : "corrected",
          status: "pending",
          currentStep: "人事",
          createdAt: new Date(Date.UTC(2026, 10, 14, 2)).toISOString(),
          appliedActionId: null,
        }
        state.requests.push(request)
        return json(
          {
            id: request.id,
            application_id: null,
            target_employee_code: employee.code,
            kind: request.kind,
            status: "pending",
            current_step: request.currentStep,
            created_at: request.createdAt,
            replayed: false,
          },
          201,
        )
      }
      let recorded: MockAction
      if (original !== undefined) {
        recorded = correct(state, original, summary)
      } else {
        state.sequence += 1
        recorded = {
          id: uuid(state.sequence),
          employeeId: employee.id,
          kind: summary.kind,
          eventOn: summary.eventOn,
          recordedAt: new Date(Date.UTC(2026, 10, 14, 2, state.sequence)).toISOString(),
          sourceType: "direct",
          sourceApplicationId: null,
          correctsActionId: null,
          summary,
          effect: summary,
        }
        state.actions.push(recorded)
      }
      employee.revision += 1
      state.companyRevision += 1
      return json(
        {
          id: recorded.id,
          kind: recorded.kind,
          event_on: recorded.eventOn,
          recorded_at: recorded.recordedAt,
          source_type: recorded.sourceType,
          source_application_id: null,
          corrects_action_id: recorded.correctsActionId,
          summary: recorded.summary,
          replayed: false,
        },
        201,
      )
    }

    if (path === "/company/employee-registrations" && method === "POST") {
      if (!admin) return failure(403, "forbidden", "登録する権限がありません")
      const code = text(body.code)
      const name = text(body.name)
      const email = text(body.email)
      if (code === null || name === null || email === null || !isDate(body.hire_on))
        return failure(400, "invalid_body", "入力を確認してください")
      if (body.expected_company_revision !== state.companyRevision)
        return failure(409, "conflict", "会社の情報が更新されています")
      if (state.employees.some((employee) => employee.code === code))
        return failure(409, "employee_code_conflict", "同じコードの従業員がいます")
      const summary = summarize(state, {
        kind: "rehire",
        employeeCode: code,
        eventOn: body.hire_on,
        employmentType: body.employment_type,
        departmentCode: body.department_code,
        positionCode: body.position_code,
        managerEmployeeCode: body.manager_employee_code,
      })
      if (typeof summary === "string") return failure(400, "invalid_change", summary)
      const employee: MockEmployee = {
        id: `employee-${code.toLowerCase()}`,
        code,
        name,
        email,
        phone: null,
        personRevision: 1,
        revision: 1,
      }
      state.employees.push(employee)
      state.sequence += 1
      const hire = { ...summary, kind: "hire" }
      state.actions.push({
        id: uuid(state.sequence),
        employeeId: employee.id,
        kind: "hire",
        eventOn: hire.eventOn,
        recordedAt: new Date(Date.UTC(2026, 10, 14, 3)).toISOString(),
        sourceType: "direct",
        sourceApplicationId: null,
        correctsActionId: null,
        summary: hire,
        effect: hire,
      })
      state.companyRevision += 1
      return json(
        {
          code,
          name,
          dept_name: summary.department?.name ?? null,
          position: summary.positionTitle ?? null,
          email,
          status: "active",
          role: body.role,
          replayed: false,
          passkey_enrollment: null,
        },
        201,
      )
    }

    if (path === "/company/my-profile") {
      if (root.scenario === "unlinked" || self === undefined)
        return failure(403, "forbidden", "従業員と未連携です")
      if (method === "GET")
        return json({ name: self.name, phone: self.phone, profile: profileVersion(state, self) })
      if (method === "PUT") {
        const profile = body.profile as { personRevision?: unknown } | undefined
        if (text(body.reason) === null) return failure(400, "invalid_body", "理由が必要です")
        if (profile?.personRevision !== self.personRevision)
          return failure(409, "conflict", "ほかの人が先に更新しました")
        self.phone = text(body.phone)
        self.personRevision += 1
        state.companyRevision += 1
        return json({ phone: self.phone, profile: profileVersion(state, self), replayed: false })
      }
      return null
    }

    if (path === "/company/my-direct-reports" && method === "GET") {
      if (root.scenario === "unlinked" || self === undefined) return json({ data: [] })
      const data = state.employees
        .filter((employee) => {
          const now = snapshot(state, employee, TODAY)
          return now.status === "active" && now.primary?.managerCode === self.code
        })
        .map((employee) => {
          const row = directoryEntry(state, employee)
          return {
            employee_id: employee.id,
            code: employee.code,
            name: employee.name,
            dept_name: row.organization_unit_name,
            position: row.position,
          }
        })
      return json({ data })
    }

    return null
  },
})
