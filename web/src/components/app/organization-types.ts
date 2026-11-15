/** 組織と等級の画面が読むAPIの応答の形と、表示のための小さな計算。 */

/** `/company/organization-tree` の一つの組織単位。 */
export type OrganizationTreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: OrganizationTreeNode[]
}

/** `/company/organization-units` と `/company/organization-units/:code` の一件。 */
export type OrganizationUnit = {
  id: string
  code: string
  name: string
  parent_code: string | null
  manager_employee_code: string | null
  organization_revision: number
  as_of: string
}

/** `/company/organization-units/:code/members` の一人。 */
export type OrganizationMember = {
  employee_code: string
  employee_name: string
  position: string | null
  manager_employee_code: string | null
  is_manager: boolean
}

export type MyOrganizationUnits = {
  data: { code: string; name: string; assignment_type: "primary" | "concurrent" }[]
}

/** `/company/reporting-lines/:employeeCode` の一人。depth 0 が本人、1 が直属の上長。 */
export type ReportingNode = {
  employee_id: string
  employee_code: string | null
  employee_name: string
  department_code: string | null
  position: string | null
  depth: number
  manager_employee_ids: string[]
}

export type OrganizationProfileVersion = {
  organizationId: string
  organizationRevision: number
  resourceId: string | null
  resourceRevision: number
  effectiveOn: string
  effectiveTo: string | null
  sourceFingerprint: string
}

/** `/company/organization-profile` の応答。 */
export type OrganizationProfile = {
  name: string
  representativeName: string
  locale: string
  timeZone: string
  fiscalYearStartMonth: number
  version: OrganizationProfileVersion
}

/** 会社の公開資源の一つの版。 */
export type CompanyResource<A = Record<string, unknown>> = {
  organizationId: string
  type: string
  id: string
  revision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: A
}

/** `/company/definitions` と `/company/organization-snapshots` の応答。 */
export type CompanyResourceList = {
  organizationId: string
  organizationRevision: number
  resources: CompanyResource[]
}

export type OrganizationUnitKind = "COMPANY" | "DIVISION" | "DEPARTMENT" | "TEAM" | "OTHER"

export type OrganizationUnitAttributes = {
  organizationUnitId: string
  code: string
  officialName: string
  kind: OrganizationUnitKind
  parentOrganizationUnitId: string | null
}

export type GradeAttributes = {
  code: string
  officialName: string
  rank?: number | null
  description?: string | null
}

export type GradeAssignmentAttributes = {
  employeeId: string
  employmentId: string
  gradeId: string
}

/** `/company/grade-assignment-history` の応答。 */
export type GradeAssignmentHistory = {
  organizationId: string
  organizationRevision: number
  employeeId: string
  revisions: {
    id: string
    revision: number
    organizationRevision: number
    state: "active" | "void"
    effectiveFrom: string
    effectiveTo: string | null
    employeeId: string
    employmentId: string
    gradeId: string
    commandId: string
    actorAccountId: string
    reason: string
    recordedAt: number
  }[]
  nextOffset: number | null
}

/** `/company/grade-award-archives/by-employee/:employeeId` の応答。旧台帳から保全した記録。 */
export type GradeAwardArchive = {
  commandId: string
  employeeId: string
  actorAccountId: string
  reason: string
  observedOn: string
  observedCompanyRevision: number
  recordedAt: number
  snapshotDigest: string
}

/** `/company/resource-history/:type/:id` の応答。 */
export type CompanyResourceHistory<A = Record<string, unknown>> = {
  organizationId: string
  resourceType: string
  resourceId: string
  throughRevision: number
  data: {
    change: {
      organization_revision: number
      revision: number
      reason: string | null
      corrects_revision: number | null
      state: "active" | "void"
      effective_from: string
      effective_to: string | null
      recorded_at: number
    }
    resource: CompanyResource<A>
  }[]
  hasMore: boolean
  nextAfterRevision: number
}

/** `/company/authority-resolutions` の応答。 */
export type AuthorityResolution = {
  snapshot: { schemaVersion: 1; source: string; asOf: string; organizationRevision: number }
  candidates: {
    employeeId: string
    accountId: string
    qualifications: {
      criterionIndex: number
      responsibilityId: string
      holderType: "employee" | "organizational-office" | "collective-body"
      holderId: string
      delegationAllowed: boolean
      collectiveDecision: {
        votingMemberCount: number
        quorumRequired: number
        approvalRequired: number
        decisionRule: "unanimity" | "majority" | "qualified-majority"
      } | null
    }[]
  }[]
  exclusions: { employeeId: string; accountId: string; reason: "subject" }[]
}

export const UNIT_KIND_LABEL: Readonly<Record<OrganizationUnitKind, string>> = {
  COMPANY: "会社",
  DIVISION: "本部",
  DEPARTMENT: "部",
  TEAM: "チーム",
  OTHER: "その他",
}

/** 会社の暦で今日の日付（YYYY-MM-DD）。 */
export function todayOnCompanyCalendar(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now)
}

/** 有効期間が基準日から見てどこにあるか。 */
export type PeriodStatus = "scheduled" | "current" | "ended"

export function periodStatus(from: string, to: string | null, on: string): PeriodStatus {
  if (from > on) return "scheduled"
  if (to !== null && to <= on) return "ended"
  return "current"
}

/** 暦の日付を「2026年4月1日」の形にする。時差でずれないよう暦のまま扱う。 */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return value
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`
}

/** 有効期間を「2026年4月1日から」「…から…まで」の形にする。終わりの日は含まない。 */
export function formatPeriod(from: string, to: string | null): string {
  return to === null
    ? `${formatCalendarDate(from)}から`
    : `${formatCalendarDate(from)}から${formatCalendarDate(to)}の前日まで`
}

/** 記録の時刻（ミリ秒）を「2026年11月14日 10:00」の形にする。 */
export function formatRecordedAt(value: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value))
}

/** 木を平らにして、親から順に並べる。選択肢や名前の引き当てに使う。 */
export function flattenTree(
  nodes: ReadonlyArray<OrganizationTreeNode>,
  depth = 0,
): { node: OrganizationTreeNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenTree(node.children, depth + 1)])
}

/** 過去の時点の組織単位を木にし、今の姿と比べた違いを付ける。 */
export type PastTreeNode = {
  value: string
  code: string
  name: string
  kind: OrganizationUnitKind
  /** 今の名前。基準日の名前と違うときだけ入る。 */
  currentName: string | null
  /** 今は無い組織単位。 */
  removed: boolean
  /** 今は別の上位組織の下にある。 */
  moved: boolean
  children: PastTreeNode[]
}

function parentCodes(
  nodes: ReadonlyArray<OrganizationTreeNode>,
  parent: string | null = null,
  result = new Map<string, string | null>(),
): Map<string, string | null> {
  for (const node of nodes) {
    result.set(node.code, parent)
    parentCodes(node.children, node.code, result)
  }
  return result
}

export function pastOrganizationTree(
  resources: ReadonlyArray<CompanyResource>,
  current: ReadonlyArray<OrganizationTreeNode>,
): PastTreeNode[] {
  const currentByCode = new Map(flattenTree(current).map(({ node }) => [node.code, node]))
  const currentParent = parentCodes(current)
  const units = resources
    .filter((resource) => resource.type === "organization-unit" && resource.state === "active")
    .map((resource) => resource.attributes as OrganizationUnitAttributes)
  const nodes = new Map<string, PastTreeNode>()
  for (const unit of units) {
    const now = currentByCode.get(unit.code)
    nodes.set(unit.organizationUnitId, {
      value: unit.code,
      code: unit.code,
      name: unit.officialName,
      kind: unit.kind,
      currentName: now !== undefined && now.name !== unit.officialName ? now.name : null,
      removed: now === undefined,
      moved: false,
      children: [],
    })
  }
  const roots: PastTreeNode[] = []
  for (const unit of units) {
    const node = nodes.get(unit.organizationUnitId)!
    const parent =
      unit.parentOrganizationUnitId === null ? undefined : nodes.get(unit.parentOrganizationUnitId)
    if (parent === undefined) roots.push(node)
    else parent.children.push(node)
    node.moved = !node.removed && (currentParent.get(node.code) ?? null) !== (parent?.code ?? null)
  }
  const sort = (list: PastTreeNode[]) => {
    list.sort((left, right) => left.code.localeCompare(right.code))
    for (const node of list) sort(node.children)
  }
  sort(roots)
  return roots
}

/** 基準日に無かったが今はある組織単位のコード。 */
export function addedSince(
  resources: ReadonlyArray<CompanyResource>,
  current: ReadonlyArray<OrganizationTreeNode>,
): string[] {
  const then = new Set(
    resources
      .filter((resource) => resource.type === "organization-unit" && resource.state === "active")
      .map((resource) => (resource.attributes as OrganizationUnitAttributes).code),
  )
  return flattenTree(current)
    .map(({ node }) => node.code)
    .filter((code) => !then.has(code))
}
