import { z } from "zod"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import {
  reviewEvaluationPolicySchema,
  standardReviewEvaluationPolicy,
  ReviewEvaluationPolicyValue,
  type ReviewEvaluationPolicyData,
} from "@/contexts/performance-review/domain/values/review-evaluation-policy.value"

export const goalSchema = z.strictObject({
  id: z.uuid(),
  title: z.string().trim().min(1).max(500),
  success_criteria: z.string().trim().min(1).max(3000),
  weight: z.number().int().min(1).max(100),
  section_key: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,49}$/)
    .default("mbo"),
})
export const assessmentSchema = z.strictObject({
  goal_id: z.uuid(),
  score: z.number().int().min(0).max(100),
  comment: z.string().trim().min(1).max(3000),
})
export const selfAssessmentSchema = assessmentSchema.extend({
  actual: z.string().trim().min(1).max(3000),
})
export const sheetSchema = z.strictObject({
  id: z.uuid(),
  cycle_id: z.uuid(),
  owner_account_id: z.uuid(),
  employee_id: z.string().min(1),
  revision: z.number().int().positive(),
  status: z.enum([
    "draft",
    "goals_pending",
    "goals_returned",
    "goals_rejected",
    "goals_approved",
    "evaluation_pending",
    "evaluation_returned",
    "evaluation_rejected",
    "finalized",
    "cancelled",
  ]),
  goals: z.array(goalSchema).max(20),
  evaluation_policy: reviewEvaluationPolicySchema.default(() =>
    structuredClone(standardReviewEvaluationPolicy),
  ),
  self_assessments: z.array(selfAssessmentSchema).max(20),
  approval: z
    .strictObject({
      number: z.number().int().positive(),
      proposal_id: z.uuid(),
      case_id: z.uuid(),
      phase: z.enum(["goals", "evaluation"]),
    })
    .nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
})
export type ReviewSheetData = z.infer<typeof sheetSchema>
export type ReviewGoal = z.input<typeof goalSchema>
export type ReviewAssessment = z.infer<typeof assessmentSchema>
export type ReviewSelfAssessment = z.infer<typeof selfAssessmentSchema>
export type ReviewPhase = "goals" | "evaluation"

/** 評価シートの内容と状態。承認案件の正本はSystemに置く。 */
export class ReviewSheetEntity {
  private constructor(readonly data: Readonly<ReviewSheetData>) {}

  static restore(input: unknown): ReviewSheetEntity {
    const parsed = sheetSchema.safeParse(input)
    if (!parsed.success) throw new ReviewError(422, "invalid_sheet")
    const data = parsed.data
    const policy = ReviewEvaluationPolicyValue.create(data.evaluation_policy)
    data.evaluation_policy = policy.data
    policy.validateGoals(data.goals, false)
    for (const assessment of data.self_assessments) policy.validateScore(assessment.score)
    if (new Set(data.goals.map((goal) => goal.id)).size !== data.goals.length)
      throw new ReviewError(422, "duplicate_goal")
    data.goals.forEach(Object.freeze)
    Object.freeze(data.goals)
    data.self_assessments.forEach(Object.freeze)
    Object.freeze(data.self_assessments)
    if (data.approval !== null) Object.freeze(data.approval)
    return new ReviewSheetEntity(Object.freeze(data))
  }

  static create(
    input: Pick<ReviewSheetData, "id" | "cycle_id" | "owner_account_id" | "employee_id"> & {
      goals: ReviewGoal[]
      evaluation_policy?: ReviewEvaluationPolicyData
    },
    at: string,
  ) {
    return ReviewSheetEntity.restore({
      ...input,
      revision: 1,
      status: "draft",
      self_assessments: [],
      approval: null,
      created_at: at,
      updated_at: at,
    })
  }

  reviseGoals(goals: ReviewGoal[], at: string) {
    if (!["draft", "goals_returned", "goals_rejected"].includes(this.data.status))
      throw new ReviewError(409, "goals_locked")
    return this.next(
      {
        goals: goals.map((goal) => ({ ...goal, section_key: goal.section_key ?? "mbo" })),
        status: "draft",
        self_assessments: [],
      },
      at,
    )
  }

  reopenGoals(at: string) {
    if (this.data.status !== "goals_approved")
      throw new ReviewError(409, "goals_amendment_not_allowed")
    return this.next({ status: "draft", self_assessments: [], approval: null }, at)
  }

  selfEvaluate(assessments: ReviewSelfAssessment[], at: string) {
    if (
      !["goals_approved", "evaluation_returned", "evaluation_rejected"].includes(this.data.status)
    )
      throw new ReviewError(409, "self_assessment_locked")
    this.validateAssessments(assessments)
    return this.next({ self_assessments: assessments, status: "goals_approved" }, at)
  }

  submit(phase: ReviewPhase, at: string) {
    if (phase === "goals") {
      if (!["draft", "goals_returned", "goals_rejected"].includes(this.data.status))
        throw new ReviewError(409, "goals_not_submittable")
      if (this.data.goals.length === 0) throw new ReviewError(422, "goal_weights_must_total_100")
      ReviewEvaluationPolicyValue.create(this.data.evaluation_policy).validateGoals(
        this.data.goals,
        true,
      )
    } else {
      if (
        !["goals_approved", "evaluation_returned", "evaluation_rejected"].includes(this.data.status)
      )
        throw new ReviewError(409, "evaluation_not_submittable")
      this.validateAssessments(this.data.self_assessments)
    }
    return this.next({ status: phase === "goals" ? "goals_pending" : "evaluation_pending" }, at)
  }

  decide(outcome: "pending" | "approved" | "rejected" | "returned", at: string) {
    const phase =
      this.data.status === "goals_pending"
        ? "goals"
        : this.data.status === "evaluation_pending"
          ? "evaluation"
          : null
    if (phase === null) throw new ReviewError(409, "sheet_not_pending")
    const status =
      outcome === "pending"
        ? this.data.status
        : outcome === "approved"
          ? phase === "goals"
            ? "goals_approved"
            : "finalized"
          : (`${phase}_${outcome}` as ReviewSheetData["status"])
    return this.next({ status }, at)
  }

  cancel(at: string) {
    if (["finalized", "cancelled"].includes(this.data.status))
      throw new ReviewError(409, "sheet_closed")
    return this.next({ status: "cancelled" }, at)
  }

  withApproval(approval: ReviewSheetData["approval"]) {
    return ReviewSheetEntity.restore({ ...this.data, approval })
  }

  validateAssessments(assessments: ReadonlyArray<ReviewAssessment>) {
    for (const assessment of assessments) {
      const { goal_id, score, comment } = assessment
      if (!assessmentSchema.safeParse({ goal_id, score, comment }).success)
        throw new ReviewError(422, "invalid_assessment")
      ReviewEvaluationPolicyValue.create(this.data.evaluation_policy).validateScore(score)
    }
    const ids = new Set(assessments.map((value) => value.goal_id))
    if (
      ids.size !== assessments.length ||
      ids.size !== this.data.goals.length ||
      this.data.goals.some((goal) => !ids.has(goal.id))
    )
      throw new ReviewError(422, "assessments_must_cover_each_goal")
  }

  summarizeAssessments(assessments: ReadonlyArray<ReviewAssessment>) {
    this.validateAssessments(assessments)
    return ReviewEvaluationPolicyValue.create(this.data.evaluation_policy).summarize(
      this.data.goals,
      assessments,
    )
  }

  private next(change: Partial<ReviewSheetData>, at: string) {
    if (Date.parse(at) < Date.parse(this.data.updated_at))
      throw new ReviewError(409, "clock_moved_backwards")
    return ReviewSheetEntity.restore({
      ...this.data,
      ...change,
      revision: this.data.revision + 1,
      updated_at: at,
    })
  }
}
