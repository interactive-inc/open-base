/** 従業員の画面が読むAPIの形。route の応答に合わせる。 */

export type DirectoryStatus = "active" | "leave" | "retired" | "inactive"

export type DirectoryEntry = {
  id: string
  code: string | null
  name: string
  email: string
  status: DirectoryStatus
  organization_unit_id: string | null
  organization_unit_code: string | null
  organization_unit_name: string | null
  position: string | null
}

export type DirectoryPage = { data: ReadonlyArray<DirectoryEntry>; total: number }

export type EmployeeDetail = {
  code: string
  name: string
  dept_name: string | null
  position: string | null
  email: string
  status: "active" | "leave" | "retired"
}

export type LifecycleStatus = "prehire" | "active" | "leave" | "retired"

export type LifecycleAssignment = {
  period_id: string
  employment_period_id: string
  department_code: string
  department_name: string
  assignment_type: "primary" | "concurrent"
  position_title: string | null
  manager_employee_code: string | null
  manager_employee_codes: ReadonlyArray<string>
  manager_employee_ids: ReadonlyArray<string>
  starts_on: string
  ends_on: string | null
}

export type LifecycleState = {
  employee_code: string
  as_of: string
  status: LifecycleStatus
  employment_period_id: string | null
  primary_assignment: LifecycleAssignment | null
  concurrent_assignments: ReadonlyArray<LifecycleAssignment>
  responsibility_department_codes: ReadonlyArray<string>
  employee_revision: number
  organization_revision: number
}

export type PersonnelActionKind =
  | "hire"
  | "rehire"
  | "primary_assignment_started"
  | "transferred"
  | "concurrent_assignment_started"
  | "assignment_ended"
  | "position_changed"
  | "manager_changed"
  | "department_responsibility_started"
  | "department_responsibility_ended"
  | "leave_started"
  | "returned"
  | "retired"
  | "corrected"
  | "initial_state"
  | "employment_revised"

/** 発令の要約。種類ごとに項目が違うので、画面は持っている項目だけを読む。 */
export type PersonnelActionSummary = {
  kind: PersonnelActionKind
  eventOn: string
  department?: { code: string; name: string } | null
  assignmentType?: "primary" | "concurrent"
  positionTitle?: string | null
  previousPositionTitle?: string | null
  managerEmployeeCode?: string | null
  previousManagerEmployeeCode?: string | null
  status?: "active" | "leave" | "retired"
  employmentType?: "FULL_TIME" | "PART_TIME"
  changeType?: "promotion" | "demotion" | "lateral" | "other"
  correctsActionId?: string
  replacementKind?: PersonnelActionKind
  replacementEventOn?: string
  reason?: string
}

export type LifecycleEventDisplayStatus = "correction" | "corrected" | "scheduled" | "confirmed"

export type LifecycleEvent = {
  id: string
  kind: PersonnelActionKind
  event_on: string
  recorded_at: string
  source_type: "application" | "direct" | "system"
  source_application_id: number | null
  corrects_action_id: string | null
  display_status: LifecycleEventDisplayStatus
  summary: PersonnelActionSummary
}

export type LifecycleEventPage = {
  data: ReadonlyArray<LifecycleEvent>
  next_cursor: string | null
}

export type PersonnelAction = {
  id: string
  employee_id: string
  kind: PersonnelActionKind
  current_employee: { code: string | null; name: string | null } | null
  event_on: string
  recorded_at: string
  recorded_by_account_id: string | null
  requested_by_employee_id: string | null
  source_type: "application" | "direct" | "system"
  source_application_id: number | null
  corrects_action_id: string | null
  corrected_by_action_id: string | null
  summary: PersonnelActionSummary
}

export type PersonnelActionPage = {
  data: ReadonlyArray<PersonnelAction>
  next_cursor: string | null
}

export type PersonnelActionRequestStatus = "pending" | "approved" | "rejected" | "withdrawn"

export type PersonnelActionRequest = {
  id: string
  application_id: number | null
  target_employee_code: string
  target_employee_name: string | null
  requested_by_employee_code: string | null
  requested_by_employee_name: string | null
  kind: PersonnelActionKind
  status: PersonnelActionRequestStatus
  current_step: string | null
  created_at: string
  applied_action_id: string | null
  withdrawn_at: string | null
}

export type PersonnelActionRequestList = { requests: ReadonlyArray<PersonnelActionRequest> }

export type MyProfile = { name: string; phone: string | null }

export type DirectReport = {
  employee_id: string
  code: string | null
  name: string
  dept_name: string | null
  position: string | null
}

export type DirectReportList = { data: ReadonlyArray<DirectReport> }

/** `/company/organization-units` の一件。部署で絞り込むために使う。 */
export type OrganizationUnit = {
  id: string
  code: string
  name: string
  parent_code: string | null
}

export const KIND_TEXT: Readonly<Record<PersonnelActionKind, string>> = {
  hire: "入社",
  rehire: "再入社",
  primary_assignment_started: "主所属の開始",
  transferred: "異動",
  concurrent_assignment_started: "兼務の開始",
  assignment_ended: "所属の終了",
  position_changed: "役職の変更",
  manager_changed: "上長の変更",
  department_responsibility_started: "部署責任者の開始",
  department_responsibility_ended: "部署責任者の終了",
  leave_started: "休職",
  returned: "復職",
  retired: "退職",
  corrected: "訂正",
  initial_state: "初期の状態",
  employment_revised: "雇用の訂正",
}

const CHANGE_TYPE_TEXT: Readonly<
  Record<NonNullable<PersonnelActionSummary["changeType"]>, string>
> = { promotion: "昇格", demotion: "降格", lateral: "横の異動", other: "その他" }

const STATUS_TEXT: Readonly<Record<"active" | "leave" | "retired", string>> = {
  active: "在籍",
  leave: "休職中",
  retired: "退職",
}

/** 発令の要約を、一行の日本語にする。持っていない項目は書かない。 */
export function describeSummary(summary: PersonnelActionSummary): string {
  const parts: string[] = []
  if (summary.kind === "corrected") {
    if (summary.replacementKind !== undefined)
      parts.push(`「${KIND_TEXT[summary.replacementKind]}」に訂正`)
    if (summary.replacementEventOn !== undefined) parts.push(`発令日 ${summary.replacementEventOn}`)
    return parts.join(" · ")
  }
  if (summary.department) parts.push(summary.department.name)
  if (summary.assignmentType === "concurrent") parts.push("兼務")
  if (summary.kind === "position_changed") {
    parts.push(`${summary.previousPositionTitle ?? "役職なし"} → ${summary.positionTitle ?? ""}`)
    if (summary.changeType !== undefined) parts.push(CHANGE_TYPE_TEXT[summary.changeType])
  } else if (summary.positionTitle) {
    parts.push(summary.positionTitle)
  }
  if (summary.kind === "manager_changed") {
    parts.push(
      `上長 ${summary.previousManagerEmployeeCode ?? "なし"} → ${summary.managerEmployeeCode ?? "なし"}`,
    )
  } else if (summary.managerEmployeeCode) {
    parts.push(`上長 ${summary.managerEmployeeCode}`)
  }
  if (summary.employmentType !== undefined)
    parts.push(summary.employmentType === "FULL_TIME" ? "正社員" : "パートタイム")
  if (
    summary.status !== undefined &&
    (summary.kind === "initial_state" || summary.kind === "employment_revised")
  )
    parts.push(STATUS_TEXT[summary.status])
  if (summary.reason) parts.push(summary.reason)
  return parts.join(" · ")
}

/** 日付の文字列（YYYY-MM-DD）を「2026年11月14日」にする。時差でずれないよう、日付として読む。 */
export function formatCalendarDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return value
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`
}

/** 会社の日付（東京）で今日を YYYY-MM-DD にする。基準日の初期値に使う。 */
export function todayInCompany(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now)
}
