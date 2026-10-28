import { z } from "zod"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import {
  reviewEvaluationPolicySchema,
  standardReviewEvaluationPolicy,
  ReviewEvaluationPolicyValue,
} from "@/contexts/performance-review/domain/values/review-evaluation-policy.value"

const date = z.iso.date()
export const cycleSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  starts_on: date,
  ends_on: date,
  evaluation_policy: reviewEvaluationPolicySchema.default(() =>
    structuredClone(standardReviewEvaluationPolicy),
  ),
  goals_procedure_key: z.string().min(1),
  evaluation_procedure_key: z.string().min(1),
  created_by_account_id: z.uuid(),
  created_at: z.iso.datetime(),
})
export type ReviewCycleData = z.infer<typeof cycleSchema>

/** 一つの評価期間と、その期間で固定する二つの承認規程への参照。 */
export class ReviewCycleEntity {
  private constructor(readonly data: Readonly<ReviewCycleData>) {}
  static create(input: unknown) {
    const parsed = cycleSchema.safeParse(input)
    if (!parsed.success || parsed.data.starts_on > parsed.data.ends_on)
      throw new ReviewError(422, "invalid_review_period")
    parsed.data.evaluation_policy = ReviewEvaluationPolicyValue.create(
      parsed.data.evaluation_policy,
    ).data
    return new ReviewCycleEntity(Object.freeze(parsed.data))
  }
}
