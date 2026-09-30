import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { RecordRetirementDecisionContext } from "@system/configuration/record-retirement-decision-context"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyDecisionHumanAccountsAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-decision-human-accounts.adapter"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"

type Context = CompanyContext

/** 保存済み判断の主体・代表者・委任と会社資格を現在時点で検査する。新しい判断は生成しない。 */
export class PrepareCompanyRecordDecisionReplayAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Parameters<RecordRetirementDecisionContext["prepareReplay"]>[0]) {
    const at = input.at
    if (!Number.isSafeInteger(at.getTime()))
      return new CompanyForbiddenError("判断の再送時点を確認できません")
    const proposal = input.proposal
    const original = input.attestation
    const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(proposal.decisionPolicyJson))
    if (policy instanceof Error) return policy
    const step = policy.workflow?.steps.find((step) => step.key === original.taskKey)
    if (step === undefined) return new CompanyForbiddenError("判断規程がありません")
    const query = new SystemD1ProposalAdapter(this.c)
    const tasks = await query.listTasks(proposal.caseId)
    if (tasks instanceof Error) return tasks
    const task = tasks.find(
      (task) => task.key === original.taskKey && task.round === original.round,
    )
    if (task === undefined) return new CompanyForbiddenError("判断段階がありません")
    const accounts = [...new Set([original.actorAccountId, original.representedAccountId])]
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      accountIds: [...accounts, proposal.createdByAccountId],
      employeeCodes: [...step.approvers, ...step.escalation_approvers].flatMap((selector) =>
        selector.type === "employee" ? [selector.employee_code] : [],
      ),
    })
    if (guard instanceof Error) return guard
    const humans = await new CompanyDecisionHumanAccountsAdapter({
      database: this.c.env.DB,
    }).findMany(accounts, at)
    if (humans instanceof Error) return humans
    if (accounts.some((account) => !humans.has(account)))
      return new CompanyForbiddenError("現在の判断主体を確認できません")
    const people = await new CompanyEmployeeDirectoryReadAdapter({
      env: { ...this.c.env, NOW: at.toISOString() },
    }).findForAccountIds(accounts)
    if (people instanceof Error) return people
    if (
      accounts.some(
        (accountId) =>
          people.find((person) => person.accountId === accountId)?.employee?.employment?.status !==
          "ACTIVE",
      )
    )
      return new CompanyForbiddenError("現在の在籍資格を確認できません")
    const candidates = await query.listTaskCandidateAccountIds({
      caseId: proposal.caseId,
      taskKey: task.key,
      round: task.round,
      at,
    })
    if (candidates instanceof Error) return candidates
    if (!candidates.includes(original.representedAccountId))
      return new CompanyForbiddenError("判断候補が一致しません")
    if (original.delegationId === null) {
      if (original.actorAccountId !== original.representedAccountId)
        return new CompanyForbiddenError("判断主体が一致しません")
    } else {
      if (!step.allow_delegation || task.delegationPolicy === "forbidden")
        return new CompanyForbiddenError("委任が許可されていません")
      const delegation = await query.findDelegation({
        caseId: proposal.caseId,
        actorAccountId: original.actorAccountId,
        candidateAccountIds: [original.representedAccountId],
        delegationId: original.delegationId,
        at,
      })
      if (delegation instanceof Error) return delegation
      if (delegation === null || delegation.id !== original.delegationId)
        return new CompanyForbiddenError("元の委任資格がありません")
    }
    const qualified = await new RevalidateCompanyProcedureAuthorityAdapter(this.c).revalidate({
      step,
      task,
      payload: JSON.parse(proposal.bodyJson),
      representedAccountId: original.representedAccountId,
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set(),
      dueAt: task.dueAt,
      decidedAt: at,
    })
    if (qualified !== true) return new CompanyForbiddenError("現在の会社上の判断資格がありません")
    return { guards: [guard] }
  }
}
