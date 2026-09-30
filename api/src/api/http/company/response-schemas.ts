import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 申請への承認/却下アクション 1 件。GET /application-requests/:id の approvals[] に並ぶ。 */
export const zAppApplicationApproval = z.object({
  id: z.number(),
  approver_name: z.string(),
  action: z.enum(["approve", "reject"]),
  comment: z.string().nullable(),
  created_at: z.string(),
})

export const zAppApplicationWorkflowApproval = z.object({
  id: z.number(),
  step_key: z.string(),
  round: z.number(),
  approver_name: z.string(),
  represented_approver_name: z.string(),
  action: z.enum(["approve", "reject", "return"]),
  comment: z.string().nullable(),
  created_at: z.string(),
})

export const zAppApplicationWorkflowProgress = z.object({
  current_step_key: z.string(),
  current_round: z.number(),
  started_at: z.string(),
  due_at: z.string().nullable(),
  returned: z.boolean(),
  steps: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      rejection_behavior: z.enum(["reject", "return"]),
      status: z.enum(["waiting", "pending", "approved", "rejected", "returned"]),
    }),
  ),
  approvals: z.array(zAppApplicationWorkflowApproval),
})

/** 申請 1 件（詳細・作成のレスポンス）。GET /application-requests/:id と POST /application-requests で使う。 */
export const zAppApplication = z.object({
  id: z.number(),
  decision_target: z.object({
    proposal_version: z.number().int().positive(),
    proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
    task_key: z.string().min(1).max(100),
    task_round: z.number().int().positive(),
  }),
  can_decide: z.boolean(),
  template_code: z.string(),
  template_name: z.string(),
  applicant_name: z.string(),
  subject: z
    .object({
      type: z.enum(["employee", "prospective_employee"]),
      employee_code: z.string(),
      employee_name: z.string(),
    })
    .nullable()
    .default(null),
  target_department: z.object({ code: z.string(), name: z.string() }).nullable().default(null),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
  created_at: z.string(),
  /** 承認/却下の履歴。古い順。POST /application-requests の直後は空配列で返す。 */
  approvals: z.array(zAppApplicationApproval).default([]),
  /** テンプレートのロール名。Companyの判断資格を置き換えない。 */
  approver_roles: z.array(z.string()).default([]),
  workflow: zAppApplicationWorkflowProgress.nullable().default(null),
})

/** 承認待ち一覧（GET /application-requests/inbox）の 1 件。applicant_name を含む。 */
export const zAppApplicationInboxItem = z.object({
  id: z.number(),
  template_name: z.string(),
  applicant_name: z.string(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

/** 承認待ち一覧（GET /application-requests/inbox）のレスポンス。 */
export const zAppApplicationInboxList = z.object({
  data: z.array(zAppApplicationInboxItem),
  total: z.number(),
})

/** 全社申請一覧（GET /application-requests/admin）の 1 件。applicant_name と template_code を含む。 */
export const zAppApplicationAdminItem = z.object({
  id: z.number(),
  template_code: z.string(),
  template_name: z.string(),
  template_category: z.string(),
  applicant_id: zEmployeeId,
  applicant_name: z.string(),
  applicant_dept_name: z.string().nullable(),
  current_step: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  created_at: z.string(),
})

/** 全社申請一覧（GET /application-requests/admin）のレスポンス。 */
export const zAppApplicationAdminList = z.object({
  data: z.array(zAppApplicationAdminItem),
  total: z.number(),
})

/** 本人の申請一覧（GET /application-requests/me）の 1 件。template_id と payload を含む。 */
export const zAppApplicationMineItem = z.object({
  id: z.number().nullable(),
  template_id: z.number(),
  status: z.enum(["pending", "approved", "rejected"]),
  current_step: z.string().nullable(),
  payload: z.unknown(),
  created_at: z.string(),
})

/** 本人の申請一覧（GET /application-requests/me）のレスポンス。 */
export const zAppApplicationMineList = z.object({
  data: z.array(zAppApplicationMineItem),
  total: z.number(),
})

/** 申請内容更新（PUT /application-requests/:id）のレスポンス。 */
export const zAppApplicationUpdated = z.object({
  id: z.number().nullable(),
  status: z.enum(["pending", "approved", "rejected"]),
  payload: z.unknown(),
})

/** 承認・却下（POST /application-requests/:id/approve, /reject）のレスポンス。 */
export const zAppApplicationDecision = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
})

/** 申請テンプレート詳細（GET /templates/:code）のレスポンス。 */
export const zAppApplicationTemplate = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  schema_json: z.unknown(),
  approver_roles: z.array(z.string()),
})

/** 申請テンプレート作成・更新（POST /templates, PUT /templates/:code）のレスポンス。id を含む。 */
export const zAppApplicationTemplateDetail = z.object({
  id: z.number().nullable(),
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  schema_json: z.unknown(),
  approver_roles: z.array(z.string()),
})

/** 申請テンプレート一覧（GET /templates）の 1 件。schema_json と approver_roles は含まない。 */
export const zAppApplicationTemplateListItem = z.object({
  code: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
})

/** 申請テンプレート一覧（GET /templates）のレスポンス。 */
export const zAppApplicationTemplateList = z.object({
  data: z.array(zAppApplicationTemplateListItem),
  total: z.number(),
})

/** 部署別の在籍人数。 */
export const zAppDepartmentHeadcount = z.object({
  department_name: z.string().nullable(),
  headcount: z.number(),
})

/** 期間ごとの目標達成(done)率。done_rate は 0-1。 */
export const zAppGoalDoneRate = z.object({
  period: z.string(),
  total: z.number(),
  done: z.number(),
  done_rate: z.number(),
})

/** 経営ダッシュボードの横断集計レスポンス(GET /dashboard/management)。集計のみで予測は持たない。 */
export const zAppManagementDashboard = z.object({
  employee_count: z.number(),
  department_headcounts: z.array(zAppDepartmentHeadcount),
  recent_join_count: z.number(),
  recent_retire_count: z.number(),
  attendance_record_count: z.number(),
  leave_request_count: z.number(),
  leave_pending_count: z.number(),
  expense_count: z.number(),
  expense_pending_count: z.number(),
  open_review_cycle_count: z.number(),
  pending_application_count: z.number(),
  goal_done_rates: z.array(zAppGoalDoneRate),
})

export type AppManagementDashboard = z.infer<typeof zAppManagementDashboard>

/** 認証済み本人の社員情報（GET /me）。 */
export const zAppAuthMe = z.object({
  id: zEmployeeId,
  // 外部プロビジョニングで作られた本人は社員コードを持たない（code=null）。GET /me は本人の code を
  // そのまま返すため nullable。
  code: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  dept_name: z.string().nullable(),
  position: z.string().nullable(),
  permissions: z.array(z.string()),
  role_keys: z.array(z.string()),
  profile: z
    .object({
      employeeId: z.string(),
      organizationRevision: z.number().int().nonnegative(),
      personRevision: z.number().int().positive(),
      effectiveOn: z.string().date(),
    })
    .nullable(),
  phone: z.string().nullable(),
})

/** System Account と Company Employee を合成した管理用ディレクトリの行。 */
export const zAppAccountDirectoryItem = z.object({
  account_id: z.string().min(1).max(255),
  name: z.string().min(1),
  email: z.string().email().nullable(),
  status: z.enum(["active", "suspended", "locked"]),
})

/** 管理用アカウントディレクトリ一覧。 */
export const zAppAccountDirectoryList = z.object({
  data: z.array(zAppAccountDirectoryItem),
  total: z.number().int().nonnegative(),
})

/** 機能ゲートの現在の状態。無効化されている機能キーの一覧を返す。 */
export const zAppFeatureAvailability = z.object({
  disabled_features: z.array(z.string()),
})

/** ===== notification ===== */
export const zAppNotification = z.object({
  id: z.uuid(),
  recipient_employee_id: zEmployeeId,
  source_domain: z.string(),
  source_id: z.number().nullable(),
  kind: z.enum([
    "task",
    "approval_request",
    "approval_result",
    "reminder",
    "announcement",
    "thanks",
  ]),
  title: z.string(),
  body: z.string().nullable(),
  is_read: z.boolean(),
  created_at: z.string(),
})
