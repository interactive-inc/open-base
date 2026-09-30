import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyUnexpectedError,
  CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import type { SystemProposalView } from "@system/domain/definitions/workflow/system-proposal-view.definition"
import { SystemDecisionTargetValue } from "@system/domain/values/workflow/system-decision-target.value"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import type { SystemDecisionTaskBundle } from "@system/domain/definitions/workflow/system-decision-task-bundle.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemCaseIdSchema } from "@system/domain/schemas/workflow/system-case.schema"

type Context = CompanyContext
type Input = Readonly<{
  proposal: SystemProposalView
  decisionTarget: Readonly<{
    proposalVersion: number
    proposalDigest: string
    taskKey: string
    taskRound: number
  }>
  actorAccountId: AccountId
  actorEmployeeId: EmployeeId
  subjectEmployeeId: EmployeeId | null
  targetDepartmentCode: string | null
  excludedEmployeeIds: ReadonlySet<EmployeeId>
  action: "approve" | "reject"
  decidedAt: Date
}>

/** 表示した判断対象と現在の会社資格から、判断者・委任・次の段階を固定する。 */
export class PrepareCompanyProcedureDecisionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Input) {
    const proposal = input.proposal
    const expected = SystemDecisionTargetValue.create(input.decisionTarget)
    const current = SystemDecisionTargetValue.create({
      proposalVersion: proposal.version,
      proposalDigest: proposal.digest,
      taskKey: proposal.currentTaskKey,
      taskRound: proposal.currentTaskRound,
    })
    if (
      proposal.status !== "pending" ||
      expected instanceof Error ||
      current instanceof Error ||
      !expected.equals(current)
    )
      return new CompanyConflictError("判断対象が更新されています", "decision_target_changed")
    if (proposal.currentTaskKey === null || proposal.currentTaskRound === null)
      return new CompanyConflictError("判断段階がありません", "decision_target_changed")
    const parsed = this.parse(proposal)
    if (parsed instanceof CompanyOperationError) return parsed
    const policy = parsed.policy
    const step = policy.workflow?.steps.find(
      (candidate) => candidate.key === proposal.currentTaskKey,
    )
    if (step === undefined) return new CompanyForbiddenError("判断資格が定義されていません")
    const query = new SystemD1ProposalAdapter(this.c)
    const tasks = await query.listTasks(proposal.caseId)
    if (tasks instanceof Error)
      return new CompanyUnexpectedError("判断段階を取得できません", { cause: tasks })
    const task = tasks.find(
      (candidate) =>
        candidate.key === proposal.currentTaskKey && candidate.round === proposal.currentTaskRound,
    )
    if (task === undefined)
      return new CompanyConflictError("判断段階がありません", "decision_changed")
    const candidates = await query.listTaskCandidateAccountIds({
      caseId: proposal.caseId,
      taskKey: task.key,
      round: task.round,
      at: input.decidedAt,
    })
    if (candidates instanceof Error)
      return new CompanyUnexpectedError("判断候補を取得できません", { cause: candidates })
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({
      accountIds: [...candidates, input.actorAccountId, proposal.createdByAccountId],
      employeeCodes: (policy.workflow?.steps ?? []).flatMap((stage) =>
        [...stage.approvers, ...stage.escalation_approvers].flatMap((selector) =>
          selector.type === "employee" ? [selector.employee_code] : [],
        ),
      ),
    })
    if (guard instanceof Error)
      return new CompanyUnexpectedError("会社資格を固定できません", { cause: guard })
    const delegation = candidates.includes(input.actorAccountId)
      ? null
      : await query.findDelegation({
          caseId: proposal.caseId,
          actorAccountId: input.actorAccountId,
          candidateAccountIds: candidates,
          at: input.decidedAt,
        })
    if (delegation instanceof Error)
      return new CompanyUnexpectedError("委任を取得できません", { cause: delegation })
    if (
      !candidates.includes(input.actorAccountId) &&
      (delegation === null || !step.allow_delegation || task.delegationPolicy === "forbidden")
    )
      return new CompanyForbiddenError("この段階の判断資格がありません")
    const representedAccountId = delegation?.representedAccountId ?? input.actorAccountId
    const directory = new CompanyEmployeeDirectoryReadAdapter({
      ...this.c,
      env: { ...this.c.env, NOW: input.decidedAt.toISOString() },
    })
    const people = await directory.findForAccountIds([
      ...new Set([input.actorAccountId, representedAccountId, proposal.createdByAccountId]),
    ])
    if (people instanceof Error)
      return new CompanyUnexpectedError("判断者の在籍を取得できません", { cause: people })
    const actor = people.find((person) => person.accountId === input.actorAccountId)?.employee
    const represented = people.find((person) => person.accountId === representedAccountId)?.employee
    const applicant = people.find(
      (person) => person.accountId === proposal.createdByAccountId,
    )?.employee
    if (
      actor?.id !== input.actorEmployeeId ||
      actor.employment?.status !== "ACTIVE" ||
      represented?.employment?.status !== "ACTIVE" ||
      input.excludedEmployeeIds.has(actor.id) ||
      input.excludedEmployeeIds.has(represented.id)
    )
      return new CompanyForbiddenError("現在の判断者資格を確認できません")
    if (applicant?.employment === null || applicant === undefined)
      return new CompanyForbiddenError("申請者を確認できません")
    const qualified = await new RevalidateCompanyProcedureAuthorityAdapter(this.c).revalidate({
      step,
      task,
      payload: parsed.payload,
      representedAccountId,
      subjectEmployeeId: input.subjectEmployeeId,
      targetDepartmentCode: input.targetDepartmentCode,
      excludedEmployeeIds: input.excludedEmployeeIds,
      dueAt: task.dueAt,
      decidedAt: input.decidedAt,
    })
    if (qualified !== true) return new CompanyForbiddenError("会社上の判断資格がありません")
    const action =
      input.action === "reject" && step.rejection_behavior === "return" ? "return" : input.action
    if (action === "return" && task.returnPolicy === "forbidden")
      return new CompanyForbiddenError("差戻しは許可されていません")
    const caseId = systemCaseIdSchema.safeParse(proposal.caseId)
    if (!caseId.success) return new CompanyUnexpectedError("案件IDが不正です")
    let nextTask: SystemDecisionTaskBundle | null = null
    let nextGuards: ReadonlyArray<D1PreparedStatement> = []
    if (action === "approve") {
      const next = await new ResolveCompanyProcedureTaskAdapter({
        c: this.c,
        policy,
        payload: parsed.payload,
        activatedAt: input.decidedAt,
        afterTaskKey: task.key,
        applicant: {
          employeeId: applicant.id,
          employeeCode: applicant.employeeCode,
          employmentStatus: applicant.employment.status,
          organizationUnitId: applicant.primaryAssignment?.organizationUnitId ?? null,
          organizationUnitCode: applicant.primaryAssignment?.organizationUnitCode ?? null,
          organizationUnitName: applicant.primaryAssignment?.organizationUnitName ?? null,
          positionTitle: applicant.primaryAssignment?.positionTitle ?? null,
        },
        authoritySubjectEmployeeId: input.subjectEmployeeId,
        targetDepartmentCode: input.targetDepartmentCode,
        excludedEmployeeIds: input.excludedEmployeeIds,
      }).resolveCompanyProcedureTask()
      if (next instanceof Error) return new CompanyForbiddenError("次の判断段階を解決できません")
      if (next !== null) {
        const bundle = createSystemDecisionTask({
          task: next.task,
          caseId: caseId.data,
          createdByAccountId: proposal.createdByAccountId,
          proposalDigest: proposal.digest,
        })
        if (bundle instanceof Error)
          return new CompanyUnexpectedError("次の判断段階が不正です", { cause: bundle })
        nextTask = bundle
        nextGuards = next.guards
      }
    }
    return {
      caseId: caseId.data,
      taskKey: task.key,
      round: task.round,
      actorAccountId: input.actorAccountId,
      representedAccountId,
      delegationId: delegation?.id ?? null,
      action,
      proposalDigest: proposal.digest,
      nextTask,
      guards: [guard, ...nextGuards],
    }
  }

  private parse(proposal: SystemProposalView) {
    try {
      const policy = parseCompanyProcedureDecisionPolicy(JSON.parse(proposal.decisionPolicyJson))
      const payload: unknown = JSON.parse(proposal.bodyJson)
      return policy instanceof Error
        ? new CompanyForbiddenError("承認規程が不正です")
        : { policy, payload }
    } catch (cause) {
      return new CompanyUnexpectedError("承認規程を取得できません", { cause })
    }
  }
}
