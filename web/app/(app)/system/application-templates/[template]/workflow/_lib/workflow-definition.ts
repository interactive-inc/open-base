import { z } from "zod"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"
import { companyOrganizationId } from "@/lib/api/company-organization-id"

/**
 * API の正規スキーマは api/src/contexts/company/domain/definitions/company-procedure-workflow.definition.ts。
 * Web から API の実行時モジュールを取り込まず、同じ制約で編集途中の入力を安全に検証する。
 */
const codeSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)

const responsibilityTypeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/)

const workflowApproverSelectorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role"), role_key: codeSchema }),
  z.object({ type: z.literal("employee"), employee_code: codeSchema }),
  z.object({ type: z.literal("direct_manager") }),
  z.object({ type: z.literal("department_manager") }),
  z.object({ type: z.literal("target_department_manager") }),
  z.object({
    type: z.literal("responsibility"),
    responsibility_type: responsibilityTypeSchema,
    organization_unit_code: codeSchema.nullable().default(null),
  }),
  z.object({ type: z.literal("management_chain") }),
])

const governanceAuthoritySchema = z.strictObject({
  organization_id: z.literal(companyOrganizationId),
  responsibility_code: z.string().trim().min(1).max(255),
  scope: z
    .discriminatedUnion("scope_type", [
      z.strictObject({
        scope_type: z.enum(["organization-unit", "legal-entity", "site", "workplace"]),
        scope_id: z.string().regex(/^\S{1,255}$/),
      }),
      z.strictObject({
        scope_type: z.literal("region"),
        region_code: z.string().trim().min(1).max(255),
      }),
      z.strictObject({
        scope_type: z.literal("amount"),
        currency_code: z.string().regex(/^[A-Z]{3}$/),
        amount_field: z.string().min(1).max(200),
      }),
    ])
    .nullable(),
})

const workflowConditionSchema = z.object({
  source: z.enum(["payload", "applicant"]),
  field: z.string().min(1).max(200),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "exists"]),
  value: z.unknown().optional(),
})

const applicationWorkflowStepSchema = z
  .object({
    key: codeSchema,
    name: z.string().min(1).max(200),
    approvers: z.array(workflowApproverSelectorSchema).max(20),
    governance_authority: governanceAuthoritySchema.optional(),
    approval_mode: z.enum(["any", "all", "minimum"]).default("any"),
    minimum_approvals: z.number().int().min(1).max(100).optional(),
    condition_mode: z.enum(["all", "any"]).default("all"),
    conditions: z.array(workflowConditionSchema).max(20).default([]),
    due_days: z.number().int().min(0).max(365).nullable().default(null),
    escalation_approvers: z.array(workflowApproverSelectorSchema).max(20).default([]),
    rejection_behavior: z.enum(["reject", "return"]).default("reject"),
    allow_delegation: z.boolean().default(true),
  })
  .superRefine((step, context) => {
    if (step.governance_authority !== undefined) {
      if (
        step.approvers.length !== 0 ||
        step.escalation_approvers.length !== 0 ||
        step.approval_mode !== "any" ||
        step.minimum_approvals !== undefined
      ) {
        context.addIssue({
          code: "custom",
          path: ["governance_authority"],
          message: "governance authority defines its own candidates and quorum",
        })
      }
    } else if (step.approvers.length === 0) {
      context.addIssue({ code: "custom", path: ["approvers"], message: "approvers are required" })
    }
    if (step.approval_mode === "minimum" && step.minimum_approvals === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimum_approvals"],
        message: "minimum_approvals is required for minimum mode",
      })
    }
  })

export const applicationWorkflowSchema = z
  .object({
    version: z.literal(1),
    steps: z.array(applicationWorkflowStepSchema).min(1).max(20),
  })
  .superRefine((workflow, context) => {
    const seen = new Set<string>()

    for (const [index, step] of workflow.steps.entries()) {
      if (seen.has(step.key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "key"],
          message: "step key must be unique",
        })
      }
      seen.add(step.key)
    }
  })

export type WorkflowDefinitionResult =
  | { success: true; workflow: ApplicationWorkflow }
  | { success: false; error: string }

export function parseWorkflowDefinitionJson(value: string): WorkflowDefinitionResult {
  let candidate: unknown
  try {
    candidate = JSON.parse(value)
  } catch {
    return { success: false, error: "ワークフロー定義は有効な JSON で入力してください" }
  }

  const parsed = applicationWorkflowSchema.safeParse(candidate)
  if (parsed.success === false) {
    return { success: false, error: "ワークフロー定義の形式が不正です" }
  }

  return { success: true, workflow: parsed.data }
}
