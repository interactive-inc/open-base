import {
  zApplicationWorkflow,
  type ApplicationWorkflow,
} from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { z } from "zod"

const policySchema = z
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

export type CompanyProcedureDecisionPolicy = Readonly<{
  schemaVersion: 1
  qualificationContext: "company"
  approverRoles: ReadonlyArray<string>
  workflow: ApplicationWorkflow | null
  workflowRevision: number
}>

export function createCompanyProcedureDecisionPolicy(
  input: Readonly<{
    approverRoles: ReadonlyArray<string>
    workflow: ApplicationWorkflow | null
    workflowRevision?: number
  }>,
): CompanyProcedureDecisionPolicy | Error {
  const parsed = policySchema.safeParse({
    schemaVersion: 1,
    qualificationContext: "company",
    approverRoles: [...input.approverRoles],
    workflow: input.workflow,
    workflowRevision: input.workflowRevision ?? (input.workflow === null ? 0 : 1),
  })

  return parsed.success
    ? parsed.data
    : new Error("invalid Company procedure policy", {
        cause: parsed.error,
      })
}
