import { z } from "zod"
import { zCompanyProcedureGovernanceAuthority } from "@/contexts/company/domain/definitions/company-procedure-governance-authority.definition"

const code = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)

const responsibilityType = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/)

export const zWorkflowApproverSelector = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role"), role_key: code }),
  z.object({ type: z.literal("employee"), employee_code: code }),
  z.object({ type: z.literal("direct_manager") }),
  z.object({ type: z.literal("department_manager") }),
  z.object({ type: z.literal("target_department_manager") }),
  z.object({
    type: z.literal("responsibility"),
    responsibility_type: responsibilityType,
    organization_unit_code: code.nullable().default(null),
  }),
  z.object({ type: z.literal("management_chain") }),
])

export type WorkflowApproverSelector = z.infer<typeof zWorkflowApproverSelector>

export const zWorkflowCondition = z.object({
  source: z.enum(["payload", "applicant"]),
  field: z.string().min(1).max(200),
  operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "exists"]),
  value: z.unknown().optional(),
})

export const zApplicationWorkflowStep = z
  .object({
    key: code,
    name: z.string().min(1).max(200),
    approvers: z.array(zWorkflowApproverSelector).max(20),
    governance_authority: zCompanyProcedureGovernanceAuthority.optional(),
    approval_mode: z.enum(["any", "all", "minimum"]).default("any"),
    minimum_approvals: z.number().int().min(1).max(100).optional(),
    condition_mode: z.enum(["all", "any"]).default("all"),
    conditions: z.array(zWorkflowCondition).max(20).default([]),
    due_days: z.number().int().min(0).max(365).nullable().default(null),
    escalation_approvers: z.array(zWorkflowApproverSelector).max(20).default([]),
    rejection_behavior: z.enum(["reject", "return"]).default("reject"),
    allow_delegation: z.boolean().default(true),
  })
  .superRefine((step, ctx) => {
    if (step.governance_authority !== undefined) {
      if (
        step.approvers.length !== 0 ||
        step.escalation_approvers.length !== 0 ||
        step.approval_mode !== "any" ||
        step.minimum_approvals !== undefined
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["governance_authority"],
          message: "governance authority defines its own candidates and quorum",
        })
      }
    } else if (step.approvers.length === 0) {
      ctx.addIssue({ code: "custom", path: ["approvers"], message: "approvers are required" })
    }
    if (step.approval_mode === "minimum" && step.minimum_approvals === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minimum_approvals"],
        message: "minimum_approvals is required for minimum mode",
      })
    }
  })

export const zApplicationWorkflow = z
  .object({
    version: z.literal(1),
    steps: z.array(zApplicationWorkflowStep).min(1).max(20),
  })
  .superRefine((workflow, ctx) => {
    const seen = new Set<string>()

    for (const [index, step] of workflow.steps.entries()) {
      if (seen.has(step.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["steps", index, "key"],
          message: "step key must be unique",
        })
      }

      seen.add(step.key)
    }
  })

export type ApplicationWorkflow = z.infer<typeof zApplicationWorkflow>
export type ApplicationWorkflowStep = z.infer<typeof zApplicationWorkflowStep>

export function parseApplicationWorkflow(value: unknown): ApplicationWorkflow | Error {
  const parsed = zApplicationWorkflow.safeParse(value)

  return parsed.success ? parsed.data : new Error(parsed.error.message)
}
