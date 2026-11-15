import type { Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

/** 会社の公開資源の一つの版。本物の `company_resource_revisions` と同じ並びで持つ。 */
type Revision = {
  type: string
  id: string
  revision: number
  organizationRevision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: Record<string, unknown>
  reason: string
  correctsRevision: number | null
  recordedAt: number
}

type Employee = {
  id: string
  code: string
  name: string
  employmentId: string
  unitCode: string
  concurrentUnitCodes: string[]
  position: string | null
  managerId: string | null
  /** 責任者を務める組織単位。 */
  manages: string | null
}

type Profile = {
  name: string
  representativeName: string
  locale: string
  timeZone: string
  fiscalYearStartMonth: number
  version: {
    organizationId: string
    organizationRevision: number
    resourceId: string | null
    resourceRevision: number
    effectiveOn: string
    effectiveTo: string | null
    sourceFingerprint: string
  }
}

/** この領域の架空の状態。 */
export type State = {
  organizationRevision: number
  revisions: Revision[]
  employees: Employee[]
  profile: Profile | null
  archivedEmployeeIds: string[]
}

const ORGANIZATION_ID = "example-organization"
/** モックの今日。ほかの領域と同じ日に固定する。 */
const TODAY = "2026-11-14"
const RECORDED_AT = Date.UTC(2026, 10, 14, 1)
const DEFINITION_TYPES = ["grade", "responsibility"]
const SNAPSHOT_TYPES = ["organization-unit", "assignment", "grade-assignment"]

function seed(scenario: Scenario): State {
  if (scenario === "empty")
    return {
      organizationRevision: 0,
      revisions: [],
      employees: [],
      profile: null,
      archivedEmployeeIds: [],
    }
  const revisions: Revision[] = []
  let organizationRevision = 0
  const add = (
    type: string,
    id: string,
    effectiveFrom: string,
    attributes: Record<string, unknown>,
    options: {
      state?: "active" | "void"
      effectiveTo?: string | null
      reason?: string
      corrects?: number
    } = {},
  ) => {
    organizationRevision += 1
    revisions.push({
      type,
      id,
      revision: revisions.filter((item) => item.type === type && item.id === id).length + 1,
      organizationRevision,
      state: options.state ?? "active",
      effectiveFrom,
      effectiveTo: options.effectiveTo ?? null,
      attributes,
      reason: options.reason ?? "初期の登録",
      correctsRevision: options.corrects ?? null,
      // 記録した時刻は、有効になる日（未来なら初期の登録の日）に合わせる。
      recordedAt:
        Date.parse(`${effectiveFrom < "2026-11-01" ? effectiveFrom : "2026-11-01"}T00:00:00Z`) +
        organizationRevision * 60_000,
    })
  }
  const unit = (
    code: string,
    name: string,
    kind: string,
    parent: string | null,
    effectiveFrom: string,
    options: { reason?: string; state?: "active" | "void" } = {},
  ) =>
    add(
      "organization-unit",
      unitId(code),
      effectiveFrom,
      {
        organizationUnitId: unitId(code),
        code,
        officialName: name,
        kind,
        parentOrganizationUnitId: parent === null ? null : unitId(parent),
      },
      options,
    )
  unit("ROOT", "全社", "COMPANY", null, "2020-04-01")
  unit("DEV", "開発部", "DEPARTMENT", "ROOT", "2020-04-01")
  unit("QA", "品質保証室", "DEPARTMENT", "ROOT", "2020-04-01")
  unit("DEV-PLATFORM", "基盤チーム", "TEAM", "DEV", "2021-04-01")
  unit("DEV-APP", "アプリチーム", "TEAM", "QA", "2023-04-01")
  unit("SALES", "販売部", "DEPARTMENT", "ROOT", "2020-04-01")
  unit("ADMIN", "管理部", "DEPARTMENT", "ROOT", "2020-04-01")
  unit("SALES", "営業部", "DEPARTMENT", "ROOT", "2026-04-01", { reason: "部の名前を変えた" })
  unit("DEV-APP", "アプリチーム", "TEAM", "DEV", "2026-07-01", {
    reason: "品質保証室の廃止に伴い開発部へ移した",
  })
  unit("QA", "品質保証室", "DEPARTMENT", "ROOT", "2026-07-01", {
    state: "void",
    reason: "開発部へ統合した",
  })
  unit("NEW-BIZ", "とても長い名前の新規事業推進準備室", "OTHER", "ROOT", "2026-10-01", {
    reason: "新規事業の準備のため新設",
  })

  const grade = (code: string, name: string, rank: number, from = "2020-04-01") =>
    add("grade", `grade-${code.toLowerCase()}`, from, {
      code,
      officialName: name,
      rank,
      description: null,
    })
  grade("G1", "一般", 1)
  grade("G2", "主任", 2)
  grade("G3", "係長", 3)
  grade("G4", "課長", 4)
  grade("G5", "部長", 5)
  add(
    "grade",
    "grade-g3",
    "2020-04-01",
    { code: "G3", officialName: "係長・専門職", rank: 3, description: "専門職を含む" },
    { reason: "名前の誤りを訂正", corrects: 1 },
  )
  grade("G6", "上級専門職", 6, "2027-04-01")
  add("grade", "grade-g0", "2020-04-01", { code: "G0", officialName: "見習い", rank: 0 })
  add(
    "grade",
    "grade-g0",
    "2020-04-01",
    { code: "G0", officialName: "見習い", rank: 0 },
    { state: "void", reason: "使っていない定義を取り消した" },
  )

  add("responsibility", "responsibility-expense", "2020-04-01", {
    code: "expense-approval",
    officialName: "経費の承認",
  })
  add("responsibility", "responsibility-personnel", "2020-04-01", {
    code: "personnel-approval",
    officialName: "人事の承認",
  })
  add("responsibility", "responsibility-board", "2020-04-01", {
    code: "board-resolution",
    officialName: "取締役会の決議",
  })

  const employee = (
    number: number,
    name: string,
    unitCode: string,
    position: string | null,
    manager: number | null,
    manages: string | null = null,
  ): Employee => ({
    id: employeeId(number),
    code: `E${String(number).padStart(3, "0")}`,
    name,
    employmentId: `employment-${String(number).padStart(3, "0")}`,
    unitCode,
    concurrentUnitCodes: number === 1 ? ["NEW-BIZ"] : [],
    position,
    managerId: manager === null ? null : employeeId(manager),
    manages,
  })
  const employees = [
    employee(1, "Example Administrator", "DEV", "部長", 10, "DEV"),
    employee(2, "Example Member", "DEV-PLATFORM", "チームリーダー", 1, "DEV-PLATFORM"),
    employee(3, "Example Engineer A", "DEV-PLATFORM", null, 2),
    employee(4, "Example Engineer B", "DEV-APP", "チームリーダー", 1, "DEV-APP"),
    employee(5, "Example Engineer C", "DEV-APP", null, 4),
    employee(6, "Example Sales A", "SALES", "部長", 10, "SALES"),
    employee(7, "Example Sales B", "SALES", null, 6),
    employee(8, "Example Staff A", "ADMIN", "部長", 10, "ADMIN"),
    employee(9, "Example Planner", "NEW-BIZ", "室長", 10, "NEW-BIZ"),
    employee(10, "Example Executive", "ROOT", "代表", null, "ROOT"),
  ]

  const assign = (number: number, gradeCode: string, from: string, suffix = "a") =>
    add("grade-assignment", `grade-assignment-${String(number).padStart(3, "0")}${suffix}`, from, {
      employeeId: employeeId(number),
      employmentId: `employment-${String(number).padStart(3, "0")}`,
      gradeId: `grade-${gradeCode.toLowerCase()}`,
    })
  assign(1, "G4", "2024-04-01")
  add(
    "grade-assignment",
    "grade-assignment-001a",
    "2024-04-01",
    { employeeId: employeeId(1), employmentId: "employment-001", gradeId: "grade-g4" },
    { effectiveTo: "2025-04-01", reason: "部長への昇格のため終えた" },
  )
  assign(1, "G5", "2025-04-01", "b")
  assign(2, "G3", "2023-04-01")
  assign(3, "G2", "2024-04-01")
  assign(4, "G3", "2024-04-01")
  assign(5, "G1", "2025-04-01")
  assign(6, "G5", "2022-04-01")
  assign(7, "G2", "2023-04-01")
  assign(8, "G5", "2021-04-01")
  assign(9, "G4", "2026-10-01")

  return {
    organizationRevision,
    revisions,
    employees,
    profile: {
      name: "Example 株式会社",
      representativeName: "Example Executive",
      locale: "ja-JP",
      timeZone: "Asia/Tokyo",
      fiscalYearStartMonth: 4,
      version: {
        organizationId: ORGANIZATION_ID,
        organizationRevision,
        resourceId: "company-profile",
        resourceRevision: 2,
        effectiveOn: "2026-04-01",
        effectiveTo: null,
        sourceFingerprint: "0".repeat(64),
      },
    },
    archivedEmployeeIds: [employeeId(3)],
  }
}

function unitId(code: string) {
  return `unit-${code.toLowerCase()}`
}

function employeeId(number: number) {
  return `employee-${String(number).padStart(3, "0")}`
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function failure(status: number, error: string, code?: string) {
  return Response.json(code === undefined ? { error } : { error, code }, { status })
}

/** 各資源の最新の版。予約中のものも含む。取消済みは除く。 */
function heads(state: State, types: ReadonlyArray<string>): Revision[] {
  const latest = new Map<string, Revision>()
  for (const item of state.revisions) {
    if (!types.includes(item.type)) continue
    const key = `${item.type}/${item.id}`
    const known = latest.get(key)
    if (known === undefined || known.revision < item.revision) latest.set(key, item)
  }
  return [...latest.values()].filter((item) => item.state === "active")
}

/** 基準日に有効だった各資源の版。 */
function asOf(state: State, types: ReadonlyArray<string>, date: string): Revision[] {
  const chosen = new Map<string, Revision>()
  for (const item of state.revisions) {
    if (!types.includes(item.type) || item.effectiveFrom > date) continue
    const key = `${item.type}/${item.id}`
    const known = chosen.get(key)
    if (
      known === undefined ||
      known.effectiveFrom < item.effectiveFrom ||
      (known.effectiveFrom === item.effectiveFrom && known.revision < item.revision)
    )
      chosen.set(key, item)
  }
  return [...chosen.values()].filter(
    (item) => item.state === "active" && (item.effectiveTo === null || item.effectiveTo > date),
  )
}

function asResource(item: Revision) {
  return {
    organizationId: ORGANIZATION_ID,
    type: item.type,
    id: item.id,
    revision: item.revision,
    state: item.state,
    effectiveFrom: item.effectiveFrom,
    effectiveTo: item.effectiveTo,
    attributes: item.attributes,
  }
}

type Unit = { id: string; code: string; name: string; parentCode: string | null }

function currentUnits(state: State): Unit[] {
  const units = asOf(state, ["organization-unit"], TODAY)
  const codeById = new Map(units.map((item) => [item.id, String(item.attributes.code)]))
  return units
    .map((item) => ({
      id: item.id,
      code: String(item.attributes.code),
      name: String(item.attributes.officialName),
      parentCode:
        typeof item.attributes.parentOrganizationUnitId === "string"
          ? (codeById.get(item.attributes.parentOrganizationUnitId) ?? null)
          : null,
    }))
    .sort((left, right) => left.code.localeCompare(right.code))
}

function unitResponse(state: State, unit: Unit) {
  return {
    id: unit.id,
    code: unit.code,
    name: unit.name,
    parent_code: unit.parentCode,
    manager_employee_code: state.employees.find((item) => item.manages === unit.code)?.code ?? null,
    organization_revision: state.organizationRevision,
    as_of: TODAY,
  }
}

function inUnit(employee: Employee, code: string) {
  return employee.unitCode === code || employee.concurrentUnitCodes.includes(code)
}

function record(
  state: State,
  input: Omit<Revision, "revision" | "organizationRevision" | "recordedAt" | "correctsRevision">,
) {
  state.organizationRevision += 1
  const revision: Revision = {
    ...input,
    revision:
      state.revisions.filter((item) => item.type === input.type && item.id === input.id).length + 1,
    organizationRevision: state.organizationRevision,
    correctsRevision: null,
    recordedAt: RECORDED_AT + state.organizationRevision,
  }
  state.revisions.push(revision)
  return revision
}

function readOnlyMember(scenario: Scenario) {
  return scenario === "member" ? failure(403, "この操作をする権限がありません", "forbidden") : null
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== ""
}

export const area = defineMockArea<State>({
  name: "organization",
  seed,
  handle: ({ state, root, path, method, query, body }) => {
    if (path === "/company/organization-tree" && method === "GET") {
      const units = currentUnits(state)
      type Node = {
        code: string
        name: string
        manager_employee_code: string | null
        member_count: number
        children: Node[]
      }
      const build = (parent: string | null): Node[] =>
        units
          .filter((unit) => unit.parentCode === parent)
          .map((unit) => ({
            code: unit.code,
            name: unit.name,
            manager_employee_code:
              state.employees.find((item) => item.manages === unit.code)?.code ?? null,
            member_count: state.employees.filter((item) => inUnit(item, unit.code)).length,
            children: build(unit.code),
          }))
      return json(build(null))
    }

    if (path === "/company/my-organization-units" && method === "GET") {
      if (root.scenario === "unlinked") return json({ data: [] })
      const me = state.employees.find((item) => item.id === employeeId(1))
      if (me === undefined) return json({ data: [] })
      const units = currentUnits(state)
      const name = (code: string) => units.find((unit) => unit.code === code)?.name ?? code
      return json({
        data: [
          { code: me.unitCode, name: name(me.unitCode), assignment_type: "primary" },
          ...me.concurrentUnitCodes.map((code) => ({
            code,
            name: name(code),
            assignment_type: "concurrent",
          })),
        ],
      })
    }

    if (path === "/company/organization-units") {
      if (method === "GET")
        return json(currentUnits(state).map((unit) => unitResponse(state, unit)))
      if (method !== "POST") return null
      const denied = readOnlyMember(root.scenario)
      if (denied !== null) return denied
      if (!isText(body.code) || !isText(body.name))
        return failure(400, "コードと名前を入れてください")
      const code = body.code.trim()
      const units = currentUnits(state)
      if (heads(state, ["organization-unit"]).some((item) => item.attributes.code === code))
        return failure(409, "同じコードの組織単位があります", "conflict")
      const parentCode = typeof body.parent_code === "string" ? body.parent_code : null
      const parent = units.find((unit) => unit.code === parentCode)
      if (parentCode !== null && parent === undefined)
        return failure(404, "上位の組織単位が見つかりません", "not_found")
      record(state, {
        type: "organization-unit",
        id: unitId(code),
        state: "active",
        effectiveFrom: TODAY,
        effectiveTo: null,
        attributes: {
          organizationUnitId: unitId(code),
          code,
          officialName: body.name.trim(),
          kind: parent === undefined ? "COMPANY" : "DEPARTMENT",
          parentOrganizationUnitId: parent?.id ?? null,
        },
        reason: "組織単位を新設",
      })
      return json(
        {
          id: unitId(code),
          code,
          name: body.name.trim(),
          parent_code: parentCode,
          manager_employee_code: null,
        },
        201,
      )
    }

    const unitMatch = /^\/company\/organization-units\/([^/]+)(\/members)?$/.exec(path)
    if (unitMatch !== null) {
      const code = decodeURIComponent(unitMatch[1]!)
      const unit = currentUnits(state).find((item) => item.code === code)
      if (unit === undefined) return failure(404, "組織単位が見つかりません", "not_found")
      if (unitMatch[2] !== undefined) {
        if (method !== "GET") return null
        const codeOf = (id: string | null) =>
          state.employees.find((item) => item.id === id)?.code ?? null
        return json(
          state.employees
            .filter((item) => inUnit(item, code))
            .map((item) => ({
              employee_code: item.code,
              employee_name: item.name,
              position: item.unitCode === code ? item.position : null,
              manager_employee_code: codeOf(item.managerId),
              manager_employee_codes: item.managerId === null ? [] : [codeOf(item.managerId)],
              manager_employee_ids: item.managerId === null ? [] : [item.managerId],
              is_manager: item.manages === code,
            }))
            .sort((left, right) => left.employee_code.localeCompare(right.employee_code)),
        )
      }
      if (method === "GET") return json(unitResponse(state, unit))
      if (method !== "PUT" && method !== "DELETE") return null
      const denied = readOnlyMember(root.scenario)
      if (denied !== null) return denied
      if (
        body.expected_organization_revision !== state.organizationRevision ||
        body.expected_as_of !== TODAY
      )
        return failure(409, "ほかの変更が先に入りました", "conflict")
      const head = heads(state, ["organization-unit"]).find((item) => item.id === unit.id)!
      if (method === "DELETE") {
        const units = currentUnits(state)
        if (
          units.some((item) => item.parentCode === code) ||
          state.employees.some((item) => inUnit(item, code))
        )
          return failure(
            422,
            "所属者か下位の組織単位があるため廃止できません",
            "organization_unit_in_use",
          )
        record(state, {
          ...head,
          state: "void",
          effectiveFrom: TODAY,
          reason: "組織単位を廃止",
        })
        return new Response(null, { status: 204 })
      }
      if (!isText(body.name)) return failure(400, "名前を入れてください")
      const parentCode = typeof body.parent_code === "string" ? body.parent_code : null
      const parent = currentUnits(state).find((item) => item.code === parentCode)
      if (parentCode !== null && parent === undefined)
        return failure(404, "上位の組織単位が見つかりません", "not_found")
      record(state, {
        ...head,
        effectiveFrom: TODAY,
        attributes: {
          ...head.attributes,
          officialName: body.name.trim(),
          parentOrganizationUnitId: parent?.id ?? null,
        },
        reason: "組織単位を変更",
      })
      return json({
        id: unit.id,
        code,
        name: body.name.trim(),
        parent_code: parentCode,
        manager_employee_code: null,
      })
    }

    if (path === "/company/organization-profile") {
      if (state.profile === null)
        return failure(404, "会社の情報がまだありません", "organization_profile_not_configured")
      if (method === "GET") return json(state.profile)
      if (method !== "PUT") return null
      const denied = readOnlyMember(root.scenario)
      if (denied !== null) return denied
      const version = body.version as { organizationRevision?: unknown } | undefined
      if (version?.organizationRevision !== state.profile.version.organizationRevision)
        return failure(409, "ほかの変更が先に入りました", "conflict")
      if (
        !isText(body.name) ||
        !isText(body.representativeName) ||
        !isText(body.reason) ||
        typeof body.fiscalYearStartMonth !== "number"
      )
        return failure(400, "入力を確認してください")
      state.organizationRevision += 1
      state.profile = {
        name: body.name.trim(),
        representativeName: body.representativeName.trim(),
        locale: String(body.locale),
        timeZone: String(body.timeZone),
        fiscalYearStartMonth: body.fiscalYearStartMonth,
        version: {
          ...state.profile.version,
          organizationRevision: state.organizationRevision,
          resourceRevision: state.profile.version.resourceRevision + 1,
          effectiveOn: TODAY,
        },
      }
      return json({ organizationRevision: state.organizationRevision })
    }

    if (
      (path === "/company/definitions" || path === "/company/organization-snapshots") &&
      method === "GET"
    ) {
      const type = query.get("type")
      const types =
        path === "/company/organization-snapshots"
          ? SNAPSHOT_TYPES
          : type === null
            ? DEFINITION_TYPES
            : [type]
      const date = query.get("effective_on") ?? query.get("as_of")
      const resources = (date === null ? heads(state, types) : asOf(state, types, date)).map(
        asResource,
      )
      if (path === "/company/organization-snapshots")
        resources.push(
          ...state.employees.map((item) => ({
            organizationId: ORGANIZATION_ID,
            type: "assignment",
            id: `assignment-${item.id}`,
            revision: 1,
            state: "active" as const,
            effectiveFrom: "2020-04-01",
            effectiveTo: null,
            attributes: {
              employeeId: item.id,
              employmentId: item.employmentId,
              organizationUnitId: unitId(item.unitCode),
              assignmentType: "PRIMARY",
              positionTitle: item.position,
            },
          })),
        )
      return json({
        organizationId: ORGANIZATION_ID,
        organizationRevision: state.organizationRevision,
        resources,
      })
    }

    if (
      (path === "/company/definitions" || path === "/company/organization-changes") &&
      method === "POST"
    ) {
      const denied = readOnlyMember(root.scenario)
      if (denied !== null) return denied
      const allowed = path === "/company/definitions" ? DEFINITION_TYPES : ["grade-assignment"]
      const resources = Array.isArray(body.resources)
        ? (body.resources as Array<Record<string, unknown>>)
        : []
      if (!isText(body.reason) || resources.length === 0)
        return failure(400, "理由を入れてください")
      const current = heads(state, allowed)
      for (const resource of resources) {
        if (!allowed.includes(String(resource.type)))
          return failure(501, `このモックでは扱いません: ${String(resource.type)}`)
        const known = state.revisions.filter(
          (item) => item.type === resource.type && item.id === resource.id,
        ).length
        if (resource.revision !== known + 1)
          return failure(409, "ほかの変更が先に入りました", "conflict")
        const attributes = resource.attributes as Record<string, unknown>
        if (
          resource.type === "grade" &&
          resource.revision === 1 &&
          current.some((item) => item.type === "grade" && item.attributes.code === attributes.code)
        )
          return failure(409, "同じコードの等級があります", "conflict")
      }
      if (path === "/company/organization-changes") {
        const next = [
          ...current.filter((item) => !resources.some((resource) => resource.id === item.id)),
          ...resources.filter((resource) => resource.state === "active"),
        ] as Array<{
          id: string
          effectiveFrom: string
          effectiveTo: string | null
          attributes: Record<string, unknown>
        }>
        const overlaps = next.some((left) =>
          next.some(
            (right) =>
              left.id !== right.id &&
              left.attributes.employmentId === right.attributes.employmentId &&
              (right.effectiveTo === null || left.effectiveFrom < right.effectiveTo) &&
              (left.effectiveTo === null || right.effectiveFrom < left.effectiveTo),
          ),
        )
        if (overlaps)
          return failure(422, "割当の期間が重なっています", "company_invariant_violation")
      }
      for (const resource of resources)
        record(state, {
          type: String(resource.type),
          id: String(resource.id),
          state: resource.state === "void" ? "void" : "active",
          effectiveFrom: String(resource.effectiveFrom),
          effectiveTo: typeof resource.effectiveTo === "string" ? resource.effectiveTo : null,
          attributes: resource.attributes as Record<string, unknown>,
          reason: body.reason.trim(),
        })
      return json(
        {
          organizationId: ORGANIZATION_ID,
          organizationRevision: state.organizationRevision,
          replayed: false,
        },
        201,
      )
    }

    if (path === "/company/grade-assignment-history" && method === "GET") {
      const employee = query.get("employee_id")
      const revision = Number(query.get("organization_revision"))
      if (employee === null || !Number.isSafeInteger(revision))
        return failure(400, "入力を確認してください")
      if (revision > state.organizationRevision) return failure(400, "会社の版を確認してください")
      return json({
        organizationId: ORGANIZATION_ID,
        organizationRevision: revision,
        employeeId: employee,
        revisions: state.revisions
          .filter(
            (item) =>
              item.type === "grade-assignment" &&
              item.attributes.employeeId === employee &&
              item.organizationRevision <= revision,
          )
          .map((item) => ({
            id: item.id,
            revision: item.revision,
            organizationRevision: item.organizationRevision,
            state: item.state,
            effectiveFrom: item.effectiveFrom,
            effectiveTo: item.effectiveTo,
            employeeId: item.attributes.employeeId,
            employmentId: item.attributes.employmentId,
            gradeId: item.attributes.gradeId,
            commandId: `command-${item.organizationRevision}`,
            actorAccountId: "example-account",
            reason: item.reason,
            recordedAt: item.recordedAt,
          })),
        nextOffset: null,
      })
    }

    const archiveMatch = /^\/company\/grade-award-archives\/by-employee\/([^/]+)$/.exec(path)
    if (archiveMatch !== null && method === "GET") {
      const id = decodeURIComponent(archiveMatch[1]!)
      if (!state.archivedEmployeeIds.includes(id))
        return failure(404, "保全記録が見つかりません", "grade_award_archive_not_found")
      return json({
        commandId: "command-archive-1",
        employeeId: id,
        actorAccountId: "example-account",
        reason: "旧台帳の付与記録を保全した",
        observedOn: "2024-03-31",
        observedCompanyRevision: 1,
        recordedAt: Date.UTC(2024, 2, 31),
        snapshotDigest: "0".repeat(64),
        source: {},
      })
    }

    const historyMatch = /^\/company\/resource-history\/organization-unit\/([^/]+)$/.exec(path)
    if (historyMatch !== null && method === "GET") {
      const id = decodeURIComponent(historyMatch[1]!)
      const items = state.revisions.filter(
        (item) => item.type === "organization-unit" && item.id === id,
      )
      return json({
        organizationId: ORGANIZATION_ID,
        resourceType: "organization-unit",
        resourceId: id,
        throughRevision: state.organizationRevision,
        data: items.map((item) => ({
          change: {
            organization_revision: item.organizationRevision,
            resource_type: item.type,
            resource_id: item.id,
            revision: item.revision,
            command_id: `command-${item.organizationRevision}`,
            actor_account_id: "example-account",
            reason: item.reason,
            evidence_references: [],
            corrects_revision: item.correctsRevision,
            state: item.state,
            effective_from: item.effectiveFrom,
            effective_to: item.effectiveTo,
            recorded_at: item.recordedAt,
          },
          resource: asResource(item),
        })),
        hasMore: false,
        nextAfterRevision: items.at(-1)?.revision ?? 0,
      })
    }

    const reportingMatch = /^\/company\/reporting-lines\/([^/]+)$/.exec(path)
    if (reportingMatch !== null && method === "GET") {
      const key = decodeURIComponent(reportingMatch[1]!)
      const start = state.employees.find((item) => item.id === key || item.code === key)
      if (start === undefined) return failure(404, "従業員が見つかりません", "not_found")
      const nodes = []
      let current: Employee | undefined = start
      for (let depth = 0; current !== undefined && depth < 20; depth += 1) {
        nodes.push({
          employee_id: current.id,
          employee_code: current.code,
          employee_name: current.name,
          department_code: current.unitCode,
          position: current.position,
          depth,
          manager_employee_ids: current.managerId === null ? [] : [current.managerId],
        })
        const managerId: string | null = current.managerId
        current = state.employees.find((item) => item.id === managerId)
      }
      return json(nodes)
    }

    if (path === "/company/authority-resolutions" && method === "POST") {
      const criteria = Array.isArray(body.criteria)
        ? (body.criteria as Array<{
            responsibility_code?: unknown
            scope?: { scope_type?: unknown; scope_id?: unknown } | null
          }>)
        : []
      if (typeof body.as_of !== "string" || criteria.length === 0)
        return failure(400, "入力を確認してください")
      const responsibilities = asOf(state, ["responsibility"], body.as_of)
      const candidates = new Map<
        string,
        {
          employeeId: string
          accountId: string
          qualifications: Array<Record<string, unknown>>
        }
      >()
      for (const [index, criterion] of criteria.entries()) {
        const responsibility = responsibilities.find(
          (item) => item.attributes.code === criterion.responsibility_code,
        )
        if (responsibility === undefined)
          return failure(
            409,
            "責務が見つかりません",
            "governance_authority_responsibility_not_found",
          )
        const scopeUnit =
          criterion.scope?.scope_type === "organization-unit"
            ? currentUnits(state).find((unit) => unit.id === criterion.scope?.scope_id)
            : undefined
        const holders =
          responsibility.attributes.code === "expense-approval"
            ? state.employees.filter((item) =>
                scopeUnit === undefined ? item.manages !== null : item.manages === scopeUnit.code,
              )
            : responsibility.attributes.code === "personnel-approval"
              ? state.employees.filter((item) => item.manages === "ROOT")
              : state.employees.filter((item) => ["ROOT", "DEV"].includes(item.manages ?? ""))
        for (const holder of holders) {
          const entry = candidates.get(holder.id) ?? {
            employeeId: holder.id,
            accountId: `account-${holder.id}`,
            qualifications: [],
          }
          entry.qualifications.push({
            criterionIndex: index,
            responsibilityId: responsibility.id,
            responsibilityRevision: responsibility.revision,
            assignmentId: `responsibility-assignment-${holder.id}`,
            assignmentRevision: 1,
            holderType:
              responsibility.attributes.code === "board-resolution"
                ? "collective-body"
                : "employee",
            holderId: holder.id,
            authorityScopeId: scopeUnit === undefined ? null : `scope-${scopeUnit.id}`,
            authorityScopeRevision: scopeUnit === undefined ? null : 1,
            delegationAllowed: responsibility.attributes.code === "expense-approval",
            employmentId: holder.employmentId,
            employmentRevision: 1,
            accountEmployeeLinkId: `link-${holder.id}`,
            accountEmployeeLinkRevision: 1,
            collectiveDecision:
              responsibility.attributes.code === "board-resolution"
                ? {
                    collectiveBodyId: "collective-body-board",
                    votingMemberCount: 3,
                    quorumRequired: 2,
                    approvalRequired: 2,
                    decisionRule: "majority",
                  }
                : null,
          })
          candidates.set(holder.id, entry)
        }
      }
      const subject = typeof body.subject_employee_id === "string" ? body.subject_employee_id : null
      return json({
        snapshot: {
          schemaVersion: 1,
          source: "company-resource",
          asOf: body.as_of,
          organizationRevision: state.organizationRevision,
        },
        candidates: [...candidates.values()].filter((item) => item.employeeId !== subject),
        exclusions: [...candidates.values()]
          .filter((item) => item.employeeId === subject)
          .map((item) => ({
            employeeId: item.employeeId,
            accountId: item.accountId,
            reason: "subject",
          })),
      })
    }

    return null
  },
})
