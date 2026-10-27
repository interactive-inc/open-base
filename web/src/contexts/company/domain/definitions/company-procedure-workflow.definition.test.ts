import { expect, test } from "bun:test"
import {
  parseApplicationWorkflow,
  zApplicationWorkflow,
  zWorkflowApproverSelector,
} from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"

const employee = { type: "employee", employee_code: "REVIEWER" }
const role = { type: "role", role_key: "reviewer" }

test.each([
  { field: "approvers", selectors: [role], roleIndex: 0 },
  { field: "approvers", selectors: [employee, role], roleIndex: 1 },
  { field: "escalation_approvers", selectors: [role], roleIndex: 0 },
  { field: "escalation_approvers", selectors: [employee, role], roleIndex: 1 },
])("rejects role selectors in $field at index $roleIndex", (scenario) => {
  const workflow = {
    version: 1,
    steps: [
      {
        key: "review",
        name: "Review",
        approvers: [employee],
        escalation_approvers: [],
        [scenario.field]: scenario.selectors,
      },
    ],
  }
  const parsed = zApplicationWorkflow.safeParse(workflow)

  expect(parsed.success).toBe(false)
  if (parsed.success) throw new Error("role selector was accepted")

  expect(parsed.error.issues).toContainEqual(
    expect.objectContaining({
      path: ["steps", 0, scenario.field, scenario.roleIndex, "type"],
    }),
  )
  expect(parseApplicationWorkflow(workflow)).toBeInstanceOf(Error)

  const policy = parseCompanyProcedureDecisionPolicy({
    schemaVersion: 1,
    qualificationContext: "company",
    approverRoles: [],
    workflow,
    workflowRevision: 1,
  })

  expect(policy).toBeInstanceOf(Error)
  if (!(policy instanceof Error)) throw new Error("role policy was accepted")

  expect(policy.cause).toMatchObject({
    issues: expect.arrayContaining([
      expect.objectContaining({
        path: ["workflow", "steps", 0, scenario.field, scenario.roleIndex, "type"],
      }),
    ]),
  })
})

test.each([
  employee,
  { type: "direct_manager" },
  { type: "department_manager" },
  { type: "target_department_manager" },
  { type: "responsibility", responsibility_type: "APPROVE", organization_unit_code: null },
  { type: "responsibility", responsibility_type: "APPROVE", organization_unit_code: "ROOT" },
  { type: "management_chain" },
])("accepts executable selectors in both candidate lists: %j", (input) => {
  const selector = zWorkflowApproverSelector.parse(input)

  const workflow = parseApplicationWorkflow({
    version: 1,
    steps: [
      {
        key: "review",
        name: "Review",
        approvers: [selector],
        escalation_approvers: [selector],
      },
    ],
  })

  if (workflow instanceof Error) throw workflow

  const policy = createCompanyProcedureDecisionPolicy({ approverRoles: [], workflow })

  if (policy instanceof Error) throw policy

  expect(parseCompanyProcedureDecisionPolicy(policy)).toEqual(policy)
  expect(policy.workflow?.steps[0]?.approvers).toEqual([selector])
  expect(policy.workflow?.steps[0]?.escalation_approvers).toEqual([selector])
})

test.each([role, { type: "technical_role", roleKey: "reviewer" }, { type: "unknown" }])(
  "rejects unsupported selector: %j",
  (selector) => {
    expect(zWorkflowApproverSelector.safeParse(selector).success).toBe(false)
  },
)
