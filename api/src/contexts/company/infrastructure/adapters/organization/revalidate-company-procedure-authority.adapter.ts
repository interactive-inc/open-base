import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ResolveCompanyProcedureApproverMatchesAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-approver-matches.adapter"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemDecisionTaskView } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"

type Context = CompanyContext

/** 固定済みTaskの条件を判断時点の会社上の資格へ再適用する。 */
export class RevalidateCompanyProcedureAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async revalidate(
    input: Readonly<{
      step: ApplicationWorkflowStep
      representedAccountId: AccountId
      subjectEmployeeId: EmployeeId | null
      targetDepartmentCode: string | null
      excludedEmployeeIds: ReadonlySet<EmployeeId>
      dueAt: Date | null
      decidedAt: Date
      payload?: unknown
      task?: SystemDecisionTaskView
    }>,
  ): Promise<boolean | Error> {
    if (input.step.governance_authority !== undefined) {
      if (input.task === undefined) return new Error("frozen governance task is missing")
      const resolved = await new ResolveCompanyGovernanceTaskAdapter(this.c).resolve({
        step: input.step,
        payload: input.payload,
        subjectEmployeeId: input.subjectEmployeeId,
        excludedEmployeeIds: input.excludedEmployeeIds,
        openedAt: input.task.openedAt,
        dueAt: input.task.dueAt,
        resolvedAt: input.decidedAt,
      })
      if (resolved instanceof Error) return resolved
      if (
        resolved.task.requiredApprovals !== input.task.requiredApprovals ||
        resolved.task.requiredParticipants !== input.task.requiredParticipants ||
        resolved.task.negativeDecisionRule !== input.task.negativeDecisionRule ||
        resolved.task.delegationPolicy !== input.task.delegationPolicy ||
        resolved.task.returnPolicy !== input.task.returnPolicy
      ) {
        return new Error("Company decision rules changed after task activation")
      }
      return resolved.task.candidates.some(
        (candidate) => candidate.accountId === input.representedAccountId,
      )
    }
    const includeEscalation = input.dueAt !== null && input.decidedAt >= input.dueAt
    const matches = await new ResolveCompanyProcedureApproverMatchesAdapter({
      c: this.c,
      applicantEmployeeId: input.subjectEmployeeId,
      selectors: includeEscalation
        ? [...input.step.approvers, ...input.step.escalation_approvers]
        : input.step.approvers,
      resolvedAt: input.decidedAt.toISOString(),
      targetDepartmentCode: input.targetDepartmentCode,
    }).resolveWorkflowApproverMatches()

    if (matches instanceof Error) return matches

    return matches.some(
      (match) =>
        match.accountId === input.representedAccountId &&
        !input.excludedEmployeeIds.has(match.employeeId),
    )
  }
}
