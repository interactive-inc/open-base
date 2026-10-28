import { z } from "zod"
import {
  goalSchema,
  assessmentSchema,
  selfAssessmentSchema,
} from "@/contexts/performance-review/domain/entities/review-sheet.entity"

const common = {
  expected_revision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(3000),
}
export const reviewDecisionTargetSchema = z.strictObject({
  proposal_version: z.number().int().positive(),
  proposal_digest: z.string().regex(/^[0-9a-f]{64}$/),
  task_key: z.string().min(1).max(100),
  task_round: z.number().int().positive(),
})
export const reviewCommandSchema = z.discriminatedUnion("operation", [
  z.strictObject({
    ...common,
    operation: z.literal("revise_goals"),
    goals: z.array(goalSchema).min(1).max(20),
  }),
  z.strictObject({
    ...common,
    operation: z.literal("self_evaluate"),
    assessments: z.array(selfAssessmentSchema).min(1).max(20),
  }),
  z.strictObject({ ...common, operation: z.literal("reopen_goals") }),
  z.strictObject({ ...common, operation: z.literal("submit_goals") }),
  z.strictObject({ ...common, operation: z.literal("submit_evaluation") }),
  z.strictObject({ ...common, operation: z.literal("cancel") }),
  z.strictObject({
    ...common,
    operation: z.literal("decide"),
    action: z.enum(["approve", "reject", "return"]),
    target: reviewDecisionTargetSchema,
    assessments: z.array(assessmentSchema).min(1).max(20).optional(),
  }),
])
export type ReviewSheetCommandInput = z.input<typeof reviewCommandSchema>
