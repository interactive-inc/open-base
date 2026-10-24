import type { CompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { zApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { z } from "zod"

const currentPolicy = z
  .object({
    schemaVersion: z.literal(1),
    qualificationContext: z.literal("company"),
    approverRoles: z.array(z.string().min(1).max(100)).max(20),
    workflow: zApplicationWorkflow.nullable(),
    workflowRevision: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((policy, context) => {
    if ((policy.workflow === null) !== (policy.workflowRevision === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workflowRevision"],
        message: "workflow and workflowRevision must advance together",
      })
    }
  })

export function parseCompanyProcedureDecisionPolicy(
  input: unknown,
): CompanyProcedureDecisionPolicy | Error {
  const current = currentPolicy.safeParse(input)
  return current.success
    ? current.data
    : new Error("invalid Company procedure policy", { cause: current.error })
}
