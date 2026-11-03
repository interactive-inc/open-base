import { SystemTaskApprovalGuardAdapter } from "@system/infrastructure/adapters/workflow/system-task-approval-guard.adapter"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { afterEach, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import {
  CompanyConflictError,
  CompanyForbiddenError,
  CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { RejectSystemTask } from "@system/application/workflow/reject-system-task"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(requiredParticipants = 2) {
  const c = await createGovernanceTaskTestContext()
  if (requiredParticipants !== 2) {
    const body = c.resources.find((resource) => resource.type === "collective-body")
    if (body === undefined) throw new Error("collective body missing")
    await c.write([
      {
        ...body,
        revision: 2,
        attributes: { ...body.attributes, quorumValue: requiredParticipants },
      },
    ])
  }
  const first = c.people[1]
  const second = c.people[2]
  if (first === undefined || second === undefined) throw new Error("reviewers missing")
  const finalStep = { ...c.step, key: "zz-final-review", name: "Final review" }
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps: [c.step, finalStep] },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "authority_review",
    revision: 1,
    title: "Review",
    category: "review",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: null,
    createdByAccountId: c.creator.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  const published = await new SystemD1ProcedureRepository(c.context).publish(definition, 0)
  if (published !== true) throw published
  const task = await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
    step: c.step,
    payload: { amount: 500 },
    subjectEmployeeId: c.creator.employeeId,
    excludedEmployeeIds: new Set([c.creator.employeeId]),
    openedAt: c.at,
    dueAt: null,
    resolvedAt: c.at,
  })
  if (task instanceof Error) throw task
  const started = await new StartSystemProcedure({
    writer: new SystemD1WorkflowAdapter({ ...c.context, startGuards: task.guards }),
  }).run({
    seriesId: crypto.randomUUID(),
    version: 1,
    procedureKey: definition.key,
    procedureRevision: 1,
    body: { amount: 500 },
    createdByAccountId: c.creator.accountId,
    supersedesProposalId: null,
    createdAt: c.at,
    firstTask: task.task,
  })
  if (started instanceof Error) throw started
  const query = new SystemD1ProposalAdapter(c.context)
  const read = async () => {
    const proposal = await query.findByNumber(started.number)
    if (proposal instanceof Error || proposal === null) throw proposal
    return proposal
  }
  const prepare = async (person: typeof first, action: "approve" | "reject" = "approve") => {
    const proposal = await read()
    return new PrepareCompanyProcedureDecisionAdapter(c.context).prepare({
      proposal,
      decisionTarget: {
        proposalVersion: proposal.version,
        proposalDigest: proposal.digest,
        taskKey: proposal.currentTaskKey ?? proposal.lastTaskKey,
        taskRound: proposal.currentTaskRound ?? proposal.lastTaskRound,
      },
      actorAccountId: person.accountId,
      actorEmployeeId: person.employeeId,
      subjectEmployeeId: c.creator.employeeId,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set([c.creator.employeeId]),
      action,
      decidedAt: c.at,
    })
  }
  const approve = async (person: typeof first) => {
    const prepared = await prepare(person)
    if (prepared instanceof CompanyOperationError) throw prepared
    const saved = await new ApproveSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at })
    if (saved instanceof Error) throw saved
    return saved
  }
  return { ...c, first, second, read, prepare, approve, finalStep, query, started }
}

test("同じ時刻に進む二段階の合議で、最後に表示する判断対象を保持する", async () => {
  const c = await fixture()
  expect(await c.prepare(c.creator)).toBeInstanceOf(CompanyForbiddenError)
  expect((await c.approve(c.first)).caseStatus).toBe("pending")
  expect((await c.read()).currentTaskKey).toBe(c.step.key)
  expect((await c.approve(c.second)).caseStatus).toBe("pending")
  expect((await c.read()).currentTaskKey).toBe(c.finalStep.key)
  expect((await c.approve(c.first)).caseStatus).toBe("pending")
  expect((await c.approve(c.second)).caseStatus).toBe("approved")
  expect((await c.read()).lastTaskKey).toBe(c.finalStep.key)
  expect(await c.prepare(c.first)).toBeInstanceOf(CompanyConflictError)
})

test("準備後の会社資格変更は判断と後続段階を巻き戻す", async () => {
  const c = await fixture()
  const prepared = await c.prepare(c.first)
  if (prepared instanceof CompanyOperationError) throw prepared
  const membership = c.resources.find((resource) => resource.id === "membership:0")
  if (membership === undefined) throw new Error("membership missing")
  await c.write([
    { ...membership, revision: 2, attributes: { ...membership.attributes, voting: false } },
  ])
  expect(
    await new ApproveSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at }),
  ).toBeInstanceOf(Error)
  expect(await c.prepare(c.first)).toBeInstanceOf(CompanyForbiddenError)
  expect(await c.query.listAttestations(c.started.workflowCase.id)).toEqual([])
  expect(await c.query.listTasks(c.started.workflowCase.id)).toHaveLength(1)
})

test("最後の反対票で参加定足数を満たすと、次段階を開始し最終段階だけ案件を承認する", async () => {
  const c = await fixture(3)
  const third = c.people[3]
  if (third === undefined) throw new Error("third reviewer missing")
  for (const taskKey of [c.step.key, c.finalStep.key]) {
    expect((await c.read()).currentTaskKey).toBe(taskKey)
    expect(await c.approve(c.first)).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
    expect(await c.approve(c.second)).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
    const prepared = await c.prepare(third, "reject")
    if (prepared instanceof Error) throw prepared
    expect(prepared.action).toBe("reject")
    expect(prepared.nextTask?.task.key ?? null).toBe(
      taskKey === c.step.key ? c.finalStep.key : null,
    )
    const result = await new RejectSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: "Opposed", decidedAt: c.at })
    expect(result).toEqual({
      caseStatus: taskKey === c.step.key ? "pending" : "approved",
      taskOutcome: "approved",
    })
  }
  expect((await c.read()).status).toBe("approved")
  const attestations = await c.query.listAttestations(c.started.workflowCase.id)
  if (attestations instanceof Error) throw attestations
  expect(attestations.filter((item) => item.action === "reject")).toHaveLength(2)
})

test("反対票の準備後に賛成票が増えても、成立した合議の次段階を飛ばさない", async () => {
  const c = await fixture(3)
  const third = c.people[3]
  if (third === undefined) throw new Error("third reviewer missing")
  expect(await c.approve(c.first)).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
  const prepared = await c.prepare(third, "reject")
  if (prepared instanceof Error) throw prepared
  expect(prepared.nextTask?.task.key).toBe(c.finalStep.key)
  expect(await c.approve(c.second)).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
  expect(
    await new RejectSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at }),
  ).toEqual({
    caseStatus: "pending",
    taskOutcome: "approved",
  })
  expect((await c.read()).currentTaskKey).toBe(c.finalStep.key)
})

// 次段階だけの障害を差し込み、現在の判断者の資格検査は実際に通す。
afterEach(() => {
  restoreNext?.()
  restoreNext = undefined
})
let restoreNext: (() => void) | undefined

test.each(["pending", "rejected", "approved"] as const)(
  "次段階の候補が101人でも反対票は承認になるときだけ巻き戻す: %s",
  async (outcome) => {
    const c = await fixture(3)
    const third = c.people[3]
    if (third === undefined) throw new Error("third reviewer missing")
    const original = ResolveCompanyProcedureTaskAdapter.prototype.resolveCompanyProcedureTask
    const resolver = spyOn(
      ResolveCompanyProcedureTaskAdapter.prototype,
      "resolveCompanyProcedureTask",
    ).mockImplementation(async function (this: ResolveCompanyProcedureTaskAdapter) {
      const next = await original.call(this)
      if (next === null || next instanceof Error) throw new Error("next task missing")
      const candidate = next.task.candidates[0]
      if (candidate === undefined) throw new Error("next candidate missing")
      // 会社側の解決は成功させ、共通基盤の候補数上限で段階の作成を失敗させる。
      return {
        ...next,
        task: {
          ...next.task,
          candidates: Array.from({ length: 101 }, () => ({
            ...candidate,
            accountId: zAccountId.parse(crypto.randomUUID()),
          })),
        },
      }
    })
    restoreNext = () => resolver.mockRestore()
    const prepared = await c.prepare(third, "reject")
    expect(prepared).not.toBeInstanceOf(Error)
    if (prepared instanceof Error) throw prepared
    expect(prepared.nextTask).toBeNull()
    resolver.mockRestore()
    if (outcome === "rejected") {
      const first = await c.prepare(c.first, "reject")
      if (first instanceof Error) throw first
      expect(
        await new RejectSystemTask(
          new SystemD1WorkflowAdapter({
            ...c.context,
            decisionGuards: first.guards,
            approvalGuards: first.approvalGuards,
          }),
        ).execute({ ...first, comment: null, decidedAt: c.at }),
      ).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
    } else if (outcome === "approved") {
      await c.approve(c.first)
      await c.approve(c.second)
    }
    const result = await new RejectSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at })
    if (outcome === "approved") expect(result).toBeInstanceOf(Error)
    else expect(result).toEqual({ caseStatus: outcome, taskOutcome: outcome })
    const attestations = await c.query.listAttestations(c.started.workflowCase.id)
    if (attestations instanceof Error) throw attestations
    expect(attestations).toHaveLength(outcome === "pending" ? 1 : 2)
    expect(attestations.filter((item) => item.action === "reject")).toHaveLength(
      outcome === "approved" ? 0 : outcome === "rejected" ? 2 : 1,
    )
    expect(await c.query.listTasks(c.started.workflowCase.id)).toHaveLength(1)
    const proposal = await c.read()
    expect(proposal.status).toBe(outcome === "rejected" ? "rejected" : "pending")
    expect(proposal.currentTaskKey).toBe(outcome === "rejected" ? null : c.step.key)
  },
)

test.each([false, true])(
  "次段階を解決できなくても反対票の保留・否決を保存する: %s",
  async (alreadyRejected) => {
    const c = await fixture(3)
    if (alreadyRejected) {
      const prepared = await c.prepare(c.first, "reject")
      if (prepared instanceof Error) throw prepared
      expect(
        await new RejectSystemTask(
          new SystemD1WorkflowAdapter({
            ...c.context,
            decisionGuards: prepared.guards,
            approvalGuards: prepared.approvalGuards,
          }),
        ).execute({ ...prepared, comment: null, decidedAt: c.at }),
      ).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
    }
    const resolver = spyOn(
      ResolveCompanyProcedureTaskAdapter.prototype,
      "resolveCompanyProcedureTask",
    ).mockResolvedValue(new Error("next authority unavailable"))
    restoreNext = () => resolver.mockRestore()
    const prepared = await c.prepare(c.second, "reject")
    expect(prepared).not.toBeInstanceOf(Error)
    if (prepared instanceof Error) throw prepared
    const result = await new RejectSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at })
    const outcome = alreadyRejected ? "rejected" : "pending"
    expect(result).toEqual({ caseStatus: outcome, taskOutcome: outcome })
    expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(
      alreadyRejected ? 2 : 1,
    )
    expect(await c.query.listTasks(c.started.workflowCase.id)).toHaveLength(1)
  },
)

test("次段階の解決失敗は準備後の賛成票で承認に変わる反対票を巻き戻す", async () => {
  const c = await fixture(3)
  const third = c.people[3]
  if (third === undefined) throw new Error("third reviewer missing")
  expect(await c.approve(c.first)).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
  const resolver = spyOn(
    ResolveCompanyProcedureTaskAdapter.prototype,
    "resolveCompanyProcedureTask",
  ).mockResolvedValue(new Error("next authority unavailable"))
  restoreNext = () => resolver.mockRestore()
  const prepared = await c.prepare(third, "reject")
  expect(prepared).not.toBeInstanceOf(Error)
  if (prepared instanceof Error) throw prepared
  resolver.mockRestore()
  expect(await c.approve(c.second)).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
  expect(
    await new RejectSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at }),
  ).toBeInstanceOf(Error)
  expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(2)
  expect((await c.read()).currentTaskKey).toBe(c.step.key)
})

test.each([false, true])(
  "次段階の資格検査の失敗は反対票による承認時だけ保存を止める: %s",
  async (approving) => {
    const c = await fixture(3)
    const third = c.people[3]
    if (third === undefined) throw new Error("third reviewer missing")
    const original = ResolveCompanyProcedureTaskAdapter.prototype.resolveCompanyProcedureTask
    const resolver = spyOn(
      ResolveCompanyProcedureTaskAdapter.prototype,
      "resolveCompanyProcedureTask",
    ).mockImplementation(async function (this: ResolveCompanyProcedureTaskAdapter) {
      const next = await original.call(this)
      if (next === null || next instanceof Error) return next
      return {
        ...next,
        guards: [
          new SystemTaskApprovalGuardAdapter({
            env: c.context.env,
            approvalTask: {
              caseId: c.started.workflowCase.id,
              taskKey: c.step.key,
              round: 1,
            },
          }).prepare("SELECT json_extract('{}','next_qualification_changed')"),
        ],
      }
    })
    restoreNext = () => resolver.mockRestore()
    const prepared = await c.prepare(third, "reject")
    if (prepared instanceof Error) throw prepared
    resolver.mockRestore()
    if (approving) {
      await c.approve(c.first)
      await c.approve(c.second)
    }
    const result = await new RejectSystemTask(
      new SystemD1WorkflowAdapter({
        ...c.context,
        decisionGuards: prepared.guards,
        approvalGuards: prepared.approvalGuards,
      }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at })
    if (approving) expect(result).toBeInstanceOf(Error)
    else expect(result).toEqual({ caseStatus: "pending", taskOutcome: "pending" })
    expect(await c.query.listAttestations(c.started.workflowCase.id)).toHaveLength(
      approving ? 2 : 1,
    )
    expect(await c.query.listTasks(c.started.workflowCase.id)).toHaveLength(1)
  },
)
