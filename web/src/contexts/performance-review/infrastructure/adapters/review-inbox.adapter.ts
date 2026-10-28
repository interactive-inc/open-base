import type { ReviewContext } from "@/contexts/performance-review/configuration/review-context"
import {
  REVIEW_COMPLETION_KEYS,
  ReviewAccessAdapter,
} from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { openSystemProposals } from "@system/interface/operations/open-system-proposals"
import { prepareCompanyProcedureDecision } from "@/contexts/company/interface/operations/prepare-company-procedure-decision"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import { prepareSystemCaseReadGuard } from "@system/interface/operations/prepare-system-case-read-guard"

/** Systemの担当案件を、現在も判断資格のある評価シートだけへ絞るread model。 */
export class ReviewInboxAdapter {
  constructor(private readonly c: ReviewContext) {}
  async list(limit: number, offset: number, cycleId?: string) {
    const access = await new ReviewAccessAdapter(this.c).prepare("performance_review:read")
    const proposals = await openSystemProposals({
      ...this.c,
      visibleCompletionOperationKeys: [...REVIEW_COMPLETION_KEYS],
    }).list({
      creatorAccountIds: null,
      actorAccountId: this.c.actor.accountId,
      statuses: ["pending"],
      procedureKey: null,
      createdFrom: null,
      createdTo: null,
      includeCancelled: false,
      sort: "created_at_asc",
      limit,
      offset,
      at: this.c.now(),
    })
    if (proposals instanceof Error) throw new ReviewError(503, "review_inbox_unavailable")
    const data = [],
      guards = [...access.guards],
      repository = new ReviewSheetRepository(this.c)
    for (const proposal of proposals.proposals) {
      const payload: unknown = JSON.parse(proposal.bodyJson)
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("sheet_id" in payload) ||
        typeof payload.sheet_id !== "string"
      )
        continue
      const sheet = await repository.find(payload.sheet_id)
      if (
        sheet === null ||
        sheet.data.approval?.proposal_id !== proposal.proposalId ||
        (cycleId !== undefined && sheet.data.cycle_id !== cycleId)
      )
        continue
      const target = {
        proposal_version: proposal.version,
        proposal_digest: proposal.digest,
        task_key: proposal.currentTaskKey!,
        task_round: proposal.currentTaskRound!,
      }
      const caseGuard = await prepareSystemCaseReadGuard(this.c, {
        caseId: proposal.caseId,
        accountId: this.c.actor.accountId,
        at: this.c.now(),
      })
      if (caseGuard instanceof Error) throw new ReviewError(503, "review_authority_unavailable")
      const prepared = await prepareCompanyProcedureDecision(this.c, {
        proposal,
        decisionTarget: {
          proposalVersion: target.proposal_version,
          proposalDigest: target.proposal_digest,
          taskKey: target.task_key,
          taskRound: target.task_round,
        },
        actorAccountId: this.c.actor.accountId,
        actorEmployeeId: this.c.actor.employeeId,
        subjectEmployeeId: sheet.data.employee_id as typeof this.c.actor.employeeId,
        targetDepartmentCode: null,
        excludedEmployeeIds: new Set([sheet.data.employee_id as typeof this.c.actor.employeeId]),
        action: "approve",
        decidedAt: this.c.now(),
      })
      if (prepared instanceof CompanyOperationError) continue
      guards.push(
        caseGuard(this.c.now()),
        ...prepared.guards,
        repository.guard(sheet.data.id, sheet.data.revision),
      )
      data.push({ ...sheet.data, decision_target: target })
    }
    await repository.verify(guards)
    return {
      data,
      limit,
      offset,
      next_offset: offset + limit < proposals.total ? offset + limit : null,
    }
  }
}
