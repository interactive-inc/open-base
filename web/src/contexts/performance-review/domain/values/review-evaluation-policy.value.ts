import { z } from "zod"
import { ReviewError } from "@/contexts/performance-review/domain/errors"

export const standardReviewEvaluationPolicy = {
  version: 1 as const,
  scale: [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) })),
  sections: [{ key: "mbo", name: "目標", weight: 100 }],
}
export const reviewEvaluationPolicySchema = z
  .strictObject({
    version: z.literal(1),
    scale: z
      .array(
        z.strictObject({
          value: z.number().int().min(0).max(100),
          label: z.string().trim().min(1).max(200),
        }),
      )
      .min(2)
      .max(20),
    sections: z
      .array(
        z.strictObject({
          key: z.string().regex(/^[a-z][a-z0-9_-]{0,49}$/),
          name: z.string().trim().min(1).max(200),
          weight: z.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(10),
  })
  .superRefine((policy, context) => {
    if (
      policy.scale.some(
        (entry, index) => index > 0 && entry.value <= policy.scale[index - 1]!.value,
      )
    )
      context.addIssue({
        code: "custom",
        path: ["scale"],
        message: "scale values must be strictly increasing",
      })
    if (new Set(policy.sections.map((section) => section.key)).size !== policy.sections.length)
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "section keys must be unique",
      })
    if (policy.sections.reduce((total, section) => total + section.weight, 0) !== 100)
      context.addIssue({
        code: "custom",
        path: ["sections"],
        message: "section weights must total 100",
      })
  })
export type ReviewEvaluationPolicyData = z.infer<typeof reviewEvaluationPolicySchema>
type Goal = Readonly<{ id: string; section_key: string; weight: number }>
type Assessment = Readonly<{ goal_id: string; score: number }>

/** 期間に固定した区分・配分・評価尺度。点数の集計だけを行い、処遇を判断しない。 */
export class ReviewEvaluationPolicyValue {
  private constructor(readonly data: Readonly<ReviewEvaluationPolicyData>) {
    Object.freeze(this)
  }

  static create(input: unknown = standardReviewEvaluationPolicy) {
    const parsed = reviewEvaluationPolicySchema.safeParse(input)
    if (!parsed.success) throw new ReviewError(422, "invalid_evaluation_policy")
    parsed.data.scale.forEach(Object.freeze)
    parsed.data.sections.forEach(Object.freeze)
    Object.freeze(parsed.data.scale)
    Object.freeze(parsed.data.sections)
    return new ReviewEvaluationPolicyValue(Object.freeze(parsed.data))
  }

  validateGoals(goals: ReadonlyArray<Goal>, submitted: boolean) {
    if (new Set(goals.map((goal) => goal.id)).size !== goals.length)
      throw new ReviewError(422, "duplicate_goal")
    if (
      goals.some((goal) => !Number.isInteger(goal.weight) || goal.weight < 1 || goal.weight > 100)
    )
      throw new ReviewError(422, "invalid_goal_weights")
    if (
      goals.some((goal) => !this.data.sections.some((section) => section.key === goal.section_key))
    )
      throw new ReviewError(422, "unknown_evaluation_section")
    if (
      submitted &&
      this.data.sections.some(
        (section) =>
          goals
            .filter((goal) => goal.section_key === section.key)
            .reduce((sum, goal) => sum + goal.weight, 0) !== 100,
      )
    )
      throw new ReviewError(422, "goal_weights_must_total_100")
  }

  validateScore(score: number) {
    if (!this.data.scale.some((entry) => entry.value === score))
      throw new ReviewError(422, "invalid_assessment")
  }

  summarize(goals: ReadonlyArray<Goal>, assessments: ReadonlyArray<Assessment>) {
    this.validateGoals(goals, true)
    if (
      new Set(assessments.map((assessment) => assessment.goal_id)).size !== goals.length ||
      assessments.length !== goals.length ||
      goals.some((goal) => !assessments.some((assessment) => assessment.goal_id === goal.id))
    )
      throw new ReviewError(422, "assessments_must_cover_each_goal")
    for (const assessment of assessments) this.validateScore(assessment.score)
    const sections = this.data.sections.map((section) => ({
      ...section,
      weighted_score: goals
        .filter((goal) => goal.section_key === section.key)
        .reduce(
          (sum, goal) =>
            sum +
            (assessments.find((assessment) => assessment.goal_id === goal.id)!.score *
              goal.weight) /
              100,
          0,
        ),
    }))
    const score = sections.reduce(
      (sum, section) => sum + (section.weighted_score * section.weight) / 100,
      0,
    )
    const minimum = this.data.scale[0]!.value
    const maximum = this.data.scale.at(-1)!.value
    return {
      weighted_score: Math.round(score * 10000) / 10000,
      normalized_score: Math.round(((score - minimum) / (maximum - minimum)) * 10000) / 100,
      sections,
    }
  }
}
