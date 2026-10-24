import type { EntityId } from "@/lib/api/types/entity-id"

export type ApplicationStatus = "pending" | "approved" | "rejected"

/** GET /templates の各要素。 */
export type ApplicationTemplateResponse = {
  code: string
  name: string
  category: string
  description: string | null
}

/**
 * GET /templates/:code。api は snake_case で返し、id は含まれない
 * （templates/[code]/route.ts の responseBody は code/name/category/description/
 * schema_json/approver_roles のみ）。
 */
export type ApplicationTemplateDetail = {
  code: string
  name: string
  category: string
  description: string | null
  schema_json: unknown
  approver_roles: ReadonlyArray<string>
}

/** GET /application-requests の各要素（自分の申請一覧）。 */
export type ApplicationMineResponse = {
  id: EntityId
  template_name: string
  status: ApplicationStatus
  current_step: string | null
  created_at: string
}

/**
 * 自分の申請一覧コンポーネントが扱う表示用の項目。編集フォームで payload を JSON 編集する。
 * id は永続化前に null になりうる実 API レスポンスに合わせる。
 */
export type ApplicationListItem = {
  id: EntityId | null
  template_id: EntityId
  status: ApplicationStatus
  current_step: string | null
  created_at: string
  payload?: unknown
}

/** GET /application-requests/inbox の各要素（承認待ち一覧）。 */
export type ApplicationInboxResponse = {
  id: EntityId
  template_name: string
  applicant_name: string
  current_step: string | null
  status: ApplicationStatus
  created_at: string
}

export type ApplicationApprovalAction = "approve" | "reject"

/** 申請への承認/却下アクション 1 件。GET /application-requests/:id の approvals[] に並ぶ。 */
export type ApplicationApprovalEntry = {
  id: EntityId
  approver_name: string
  action: ApplicationApprovalAction
  comment: string | null
  created_at: string
}

/** 表示した提案と判断段階を特定する参照。 */
export type ApplicationDecisionTarget = {
  proposal_version: number
  proposal_digest: string
  task_key: string
  task_round: number
}

/** GET /company/application-requests/:id および作成のレスポンス。 */
export type ApplicationDetailResponse = {
  decision_target: ApplicationDecisionTarget
  can_decide: boolean
  id: EntityId
  template_code: string
  template_name: string
  applicant_name: string
  status: ApplicationStatus
  current_step: string | null
  payload: unknown
  created_at: string
  // 承認履歴（古い順）。POST 直後は空配列。
  approvals: ReadonlyArray<ApplicationApprovalEntry>
  // テンプレートのロール名。判断資格はAPIで再検査する。
  approver_roles: ReadonlyArray<string>
  workflow: ApplicationWorkflowProgress | null
}

export type ApplicationWorkflowProgress = {
  current_step_key: string
  current_round: number
  started_at: string
  due_at: string | null
  returned: boolean
  steps: ReadonlyArray<{
    key: string
    name: string
    rejection_behavior: "reject" | "return"
    status: "waiting" | "pending" | "approved" | "rejected" | "returned"
  }>
  approvals: ReadonlyArray<{
    id: EntityId
    step_key: string
    round: number
    approver_name: string
    represented_approver_name: string
    action: "approve" | "reject" | "return"
    comment: string | null
    created_at: string
  }>
}

/** POST /application-requests/:id/approve|reject のレスポンス。 */
export type ApplicationDecisionResponse = {
  status: ApplicationStatus
}

/** POST /application-requests のリクエスト body。 */
export type ApplicationSubmitRequest = {
  template_code: string
  payload: unknown
}
