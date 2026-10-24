import type { ApplicationWorkflow } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { UnprocessableEntityError } from "@/lib/http/errors"
import type { Context } from "@/env"

/** Company authorityとして解決できるworkflow selectorだけを許可する。 */
export async function validateApplicationWorkflowReferences(
  context: Context,
  workflow: ApplicationWorkflow,
): Promise<void> {
  const directory = openCompanyEmployeeDirectory({ env: context.env })

  for (const step of workflow.steps) {
    for (const selector of [...step.approvers, ...step.escalation_approvers]) {
      if (selector.type === "role") {
        throw new UnprocessableEntityError(
          "Account role selectors are not Company authority; use governance_authority",
        )
      }
      if (selector.type === "responsibility") {
        throw new UnprocessableEntityError(
          "Legacy responsibility selectors cannot be published; use governance_authority",
        )
      }
      // 承認者の従業員 code は、会社営業日の従業員名簿で解決できるものだけを許可する。
      const employee =
        selector.type === "employee" ? await directory.findByCode(selector.employee_code) : null
      if (employee instanceof Error) throw employee
      if (selector.type === "employee" && employee === null) {
        throw new UnprocessableEntityError(
          `unknown employee in workflow: ${selector.employee_code}`,
        )
      }
    }
  }
}
