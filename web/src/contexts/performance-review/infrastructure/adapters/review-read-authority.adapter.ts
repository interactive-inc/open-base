import type { ReviewContext } from "@/contexts/performance-review/configuration/review-context"
import type { ReviewSheetEntity } from "@/contexts/performance-review/domain/entities/review-sheet.entity"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { revalidateCompanyProcedureAuthority } from "@/contexts/company/interface/operations/revalidate-company-procedure-authority"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

/** 固定した判断候補と現在の会社資格を照合し、委任先も同じ範囲だけを読めるようにする。 */
export class ReviewReadAuthorityAdapter {
  constructor(private readonly c: ReviewContext) {
    Object.freeze(this)
  }

  async prepare(sheet: ReviewSheetEntity) {
    if (sheet.data.approval === null) throw new ReviewError(403, "review_not_visible")
    const query = openSystemProposals({ ...this.c, visibleSubjectContexts: ["performance-review"] })
    const proposal = await query.findByNumber(sheet.data.approval.number)
    if (
      proposal instanceof Error ||
      proposal === null ||
      proposal.proposalId !== sheet.data.approval.proposal_id ||
      proposal.caseId !== sheet.data.approval.case_id
    )
      throw new ReviewError(403, "review_not_visible")
    const tasks = await query.listTasks(proposal.caseId)
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(proposal.decisionPolicyJson))
    if (tasks instanceof Error || policy instanceof Error)
      throw new ReviewError(503, "review_authority_unavailable")
    const key = proposal.currentTaskKey ?? proposal.lastTaskKey
    const round = proposal.currentTaskRound ?? proposal.lastTaskRound
    const task = tasks.find((value) => value.key === key && value.round === round)
    const step = policy.workflow?.steps.find((value) => value.key === key)
    if (task === undefined || step === undefined) throw new ReviewError(403, "review_not_visible")
    const candidates = await query.listTaskCandidateAccountIds({
      caseId: proposal.caseId,
      taskKey: key,
      round,
      at: this.c.now(),
    })
    if (candidates instanceof Error) throw new ReviewError(503, "review_authority_unavailable")
    const guard = await prepareCompanyAuthoritySnapshotGuard(
      { database: this.c.env.DB },
      {
        accountIds: [...candidates, this.c.actor.accountId, proposal.createdByAccountId],
        employeeCodes: [...step.approvers, ...step.escalation_approvers].flatMap((selector) =>
          selector.type === "employee" ? [selector.employee_code] : [],
        ),
      },
    )
    if (guard instanceof Error) throw new ReviewError(503, "review_authority_unavailable")
    const delegation = candidates.includes(this.c.actor.accountId)
      ? null
      : await query.findDelegation({
          caseId: proposal.caseId,
          taskKey: key,
          round,
          actorAccountId: this.c.actor.accountId,
          candidateAccountIds: candidates,
          at: this.c.now(),
        })
    if (delegation instanceof Error) throw new ReviewError(503, "review_authority_unavailable")
    if (
      !candidates.includes(this.c.actor.accountId) &&
      (delegation === null || !step.allow_delegation || task.delegationPolicy === "forbidden")
    )
      throw new ReviewError(403, "review_not_visible")
    const representedAccountId = delegation?.representedAccountId ?? this.c.actor.accountId
    const people = await openCompanyEmployeeDirectory(this.c).findForAccountIds([
      representedAccountId,
    ])
    if (people instanceof Error) throw new ReviewError(503, "review_authority_unavailable")
    const represented = people.find((person) => person.accountId === representedAccountId)?.employee
    if (represented?.employment?.status !== "ACTIVE" || represented.id === sheet.data.employee_id)
      throw new ReviewError(403, "review_not_visible")
    const subjectEmployeeId = restoreWorkforceId("employee", sheet.data.employee_id)
    const valid = await revalidateCompanyProcedureAuthority(this.c, {
      step,
      task,
      payload: JSON.parse(proposal.bodyJson),
      representedAccountId,
      subjectEmployeeId,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set([subjectEmployeeId]),
      dueAt: task.dueAt,
      decidedAt: this.c.now(),
    })
    if (valid !== true) throw new ReviewError(403, "review_not_visible")
    return [guard]
  }
}
