import type { ApplicationStatus, Phase } from "@/components/app/phase-bar"

/** 承認待ちの一覧の一件。 */
export type InboxItem = {
  id: number
  template_name: string
  applicant_name: string
  current_step: string | null
  status: ApplicationStatus
  created_at: string
}

export type InboxList = { data: ReadonlyArray<InboxItem>; total: number }

/** 自分の申請の一覧の一件。 */
export type MyApplication = {
  id: number | null
  template_name: string
  status: ApplicationStatus
  current_step: string | null
  created_at: string
}

export type MyApplicationList = { data: ReadonlyArray<MyApplication>; total: number }

/** 承認・却下のときに、見ていた版と一致するかをサーバーが確かめるための値。 */
export type DecisionTarget = {
  proposal_version: number
  proposal_digest: string
  task_key: string
  task_round: number
}

export type ApplicationDecision = {
  id: number
  step_key: string
  round: number
  approver_name: string
  represented_approver_name: string
  action: "approve" | "reject" | "return"
  comment: string | null
  created_at: string
}

export type ApplicationDetail = {
  id: number
  decision_target: DecisionTarget
  can_decide: boolean
  template_code: string
  template_name: string
  applicant_name: string
  status: ApplicationStatus
  current_step: string | null
  payload: unknown
  created_at: string
  workflow: {
    due_at: string | null
    returned: boolean
    steps: ReadonlyArray<Phase>
    approvals: ReadonlyArray<ApplicationDecision>
  } | null
}

export type TemplateListItem = {
  code: string
  name: string
  category: string
  description: string | null
}

export type TemplateList = { data: ReadonlyArray<TemplateListItem>; total: number }

export type Template = TemplateListItem & { schema_json: unknown }

export type FormField = {
  id: string
  label: string
  type: "text" | "textarea" | "number" | "date" | "select"
  required: boolean
  options: ReadonlyArray<string>
}

const FIELD_TYPES: ReadonlyArray<FormField["type"]> = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
]

/**
 * テンプレートの入力項目を読む。形が合わない項目は捨てる。
 * 入力の検証の正本はサーバーにあり、ここは入力欄を描くためだけに使う。
 */
export function readFormFields(schema: unknown): ReadonlyArray<FormField> {
  if (typeof schema !== "object" || schema === null || !("fields" in schema)) return []
  const fields = schema.fields
  if (!Array.isArray(fields)) return []

  return fields.flatMap((field: unknown): FormField[] => {
    if (typeof field !== "object" || field === null) return []
    const item = field as Record<string, unknown>
    const type = FIELD_TYPES.find((candidate) => candidate === item.type)
    if (typeof item.id !== "string" || item.id === "" || type === undefined) return []
    return [
      {
        id: item.id,
        label: typeof item.label === "string" && item.label !== "" ? item.label : item.id,
        type,
        required: item.required === true,
        options: Array.isArray(item.options)
          ? item.options.filter((option): option is string => typeof option === "string")
          : [],
      },
    ]
  })
}

/** 差し戻された申請は、状態が承認待ちのまま `current_step` が `returned:` で始まる。 */
export function isReturnedStep(currentStep: string | null): boolean {
  return currentStep?.startsWith("returned:") === true
}

/** テンプレートの一件。承認する役割はワークフローが無いときの承認者を決める。 */
export type TemplateDetail = Template & { approver_roles: ReadonlyArray<string> }

/** 全社・部署の申請一覧の一件。 */
export type AdminApplication = {
  id: number
  template_code: string
  template_name: string
  template_category: string
  applicant_id: string
  applicant_name: string
  applicant_dept_name: string | null
  current_step: string | null
  status: ApplicationStatus
  created_at: string
}

export type AdminApplicationList = { data: ReadonlyArray<AdminApplication>; total: number }

/** 承認ワークフローで承認者を決める方法。 */
export type WorkflowApprover =
  | { type: "employee"; employee_code: string }
  | { type: "direct_manager" }
  | { type: "department_manager" }
  | { type: "target_department_manager" }
  | { type: "responsibility"; responsibility_type: string; organization_unit_code: string | null }
  | { type: "management_chain" }

/**
 * 承認ワークフローの一段。条件や引き継ぎ先など、画面で編集しない値もそのまま持ち回る。
 * 形の検証の正本はサーバーにある。
 */
export type WorkflowStep = {
  key: string
  name: string
  approvers: ReadonlyArray<WorkflowApprover>
  approval_mode: "any" | "all" | "minimum"
  minimum_approvals?: number
  due_days: number | null
  rejection_behavior: "reject" | "return"
  allow_delegation: boolean
  governance_authority?: unknown
  condition_mode?: "all" | "any"
  conditions?: ReadonlyArray<unknown>
  escalation_approvers?: ReadonlyArray<WorkflowApprover>
}

export type Workflow = { version: 1; steps: ReadonlyArray<WorkflowStep> }

/** テンプレートの承認ワークフロー。まだ無いときは `workflow` と `revision` がnull。 */
export type TemplateWorkflow = {
  workflow: Workflow | null
  revision: number | null
  updated_at: string | null
}

type DelegationParty = { id: string; code: string; name: string } | null

/** 承認の代理の一件。本人が委任元か委任先のものだけが返る。 */
export type Delegation = {
  id: number
  delegator: DelegationParty
  delegate: DelegationParty
  template_code: string | null
  starts_at: string
  ends_at: string
  cancelled_at: string | null
  created_at: string
  can_delete: boolean
}

export type DelegationList = { data: ReadonlyArray<Delegation> }

/** 承認できる人がいなくなり、止まっている申請。 */
export type WorkflowRepair = {
  id: number
  template_code: string
  template_name: string
  applicant_name: string | null
  step_key: string
  round: number
  reason: "snapshot_missing" | "inactive_candidates"
  started_at: string
}

export type WorkflowRepairList = { data: ReadonlyArray<WorkflowRepair>; total: number }
