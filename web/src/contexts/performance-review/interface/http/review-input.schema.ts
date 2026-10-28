import { z } from "zod"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { goalSchema } from "@/contexts/performance-review/domain/entities/review-sheet.entity"
import { reviewEvaluationPolicySchema } from "@/contexts/performance-review/domain/values/review-evaluation-policy.value"

const defaultWorkflow: z.input<typeof zApplicationWorkflow> = {
  version: 1,
  steps: [
    {
      key: "manager",
      name: "上長確認",
      approvers: [{ type: "direct_manager" }],
      rejection_behavior: "return",
    },
  ],
}
export const createReviewCycleSchema = z.strictObject({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  starts_on: z.iso.date(),
  ends_on: z.iso.date(),
  evaluation_policy: reviewEvaluationPolicySchema.optional(),
  reason: z.string().trim().min(1).max(3000),
  goal_workflow: zApplicationWorkflow.prefault(defaultWorkflow),
  evaluation_workflow: zApplicationWorkflow.prefault(defaultWorkflow),
})
export const createReviewSheetSchema = z.strictObject({
  id: z.uuid(),
  cycle_id: z.uuid(),
  goals: z.array(goalSchema).max(20),
  reason: z.string().trim().min(1).max(3000),
})
