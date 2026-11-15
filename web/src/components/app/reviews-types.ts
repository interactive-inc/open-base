/**
 * 評価（`/performance-review`）のAPIが返す形。
 * 正本は `contexts/performance-review` のschemaとroute。画面はこの形を読むだけで、検証はサーバーが行う。
 */

export type ReviewStatus =
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

export type ReviewGoal = {
  id: string
  title: string
  success_criteria: string
  weight: number
  section_key: string
}

export type ReviewAssessment = { goal_id: string; score: number; comment: string }

export type ReviewSelfAssessment = ReviewAssessment & { actual: string }

export type ReviewPolicy = {
  version: 1
  scale: ReadonlyArray<{ value: number; label: string }>
  sections: ReadonlyArray<{ key: string; name: string; weight: number }>
}

export type ReviewDecisionTarget = {
  proposal_version: number
  proposal_digest: string
  task_key: string
  task_round: number
}

export type ReviewSummary = {
  weighted_score: number
  normalized_score: number
  sections: ReadonlyArray<{ key: string; name: string; weight: number; weighted_score: number }>
}

export type ReviewSheet = {
  id: string
  cycle_id: string
  owner_account_id: string
  employee_id: string
  revision: number
  status: ReviewStatus
  goals: ReadonlyArray<ReviewGoal>
  evaluation_policy: ReviewPolicy
  self_assessments: ReadonlyArray<ReviewSelfAssessment>
  approval: {
    number: number
    proposal_id: string
    case_id: string
    phase: "goals" | "evaluation"
  } | null
  created_at: string
  updated_at: string
}

/** `GET /performance-review/sheets/:id`。判断の対象は承認待ちのときだけ入る。 */
export type ReviewSheetDetail = ReviewSheet & {
  decision_target: ReviewDecisionTarget | null
  self_evaluation_summary: ReviewSummary | null
}

/** `GET /performance-review/sheets?scope=inbox` の一件。いま判断できるシートだけが返る。 */
export type ReviewInboxSheet = ReviewSheet & { decision_target: ReviewDecisionTarget }

export type ReviewPage<T> = {
  data: ReadonlyArray<T>
  limit: number
  offset: number
  next_offset: number | null
}

export type ReviewCycle = {
  id: string
  name: string
  starts_on: string
  ends_on: string
  evaluation_policy: ReviewPolicy
  goals_procedure_key: string
  evaluation_procedure_key: string
  created_by_account_id: string
  created_at: string
}

export type ReviewWorkflowStep = {
  key: string
  name: string
  approvers: ReadonlyArray<{ type: string }>
  rejection_behavior?: "reject" | "return"
}

export type ReviewApprovalRoute = {
  revision: number
  workflow: { version: 1; steps: ReadonlyArray<ReviewWorkflowStep> }
}

/** `GET /performance-review/cycles/:id`。期間で固定した二つの承認経路を含む。 */
export type ReviewCycleDetail = ReviewCycle & {
  goal_approval: ReviewApprovalRoute
  evaluation_approval: ReviewApprovalRoute
}

export type ReviewOperation =
  | "create_sheet"
  | "revise_goals"
  | "reopen_goals"
  | "self_evaluate"
  | "submit_goals"
  | "submit_evaluation"
  | "cancel"
  | "decide"

/** `GET /performance-review/sheets/:id/history` の一件。版ごとの変更不能な記録。 */
export type ReviewHistoryEntry = {
  revision: number
  actor_account_id: string
  operation: ReviewOperation
  reason: string
  detail: unknown
  snapshot: ReviewSheet
  request_id: string | null
  created_at: string
}
