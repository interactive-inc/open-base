import { expect, test } from "vite-plus/test"
import { parseWorkflowDefinitionJson } from "@/app/(app)/system/application-templates/[template]/workflow/_lib/workflow-definition"

test("責務と申請金額の参照を編集用JSONで保持し、人数の上書きを拒否する", () => {
  const step = {
    key: "review",
    name: "Review",
    approvers: [],
    governance_authority: {
      organization_id: "ad4f6cb1-774b-43ae-950f-80e9bc67c66d",
      responsibility_code: "APPROVE",
      scope: { scope_type: "amount", currency_code: "JPY", amount_field: "amount" },
    },
  }
  const parsed = parseWorkflowDefinitionJson(JSON.stringify({ version: 1, steps: [step] }))
  expect(parsed.success).toBe(true)
  if (!parsed.success) return
  expect(parsed.workflow.steps[0]?.governance_authority).toEqual(step.governance_authority)
  expect(
    parseWorkflowDefinitionJson(
      JSON.stringify({
        version: 1,
        steps: [{ ...step, approval_mode: "minimum", minimum_approvals: 1 }],
      }),
    ).success,
  ).toBe(false)
})
