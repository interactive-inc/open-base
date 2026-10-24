import { expect, setDefaultTimeout, test } from "bun:test"
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

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const c = await createGovernanceTaskTestContext()
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
  const prepare = async (person: typeof first) => {
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
      action: "approve",
      decidedAt: c.at,
    })
  }
  const approve = async (person: typeof first) => {
    const prepared = await prepare(person)
    if (prepared instanceof CompanyOperationError) throw prepared
    const saved = await new ApproveSystemTask(
      new SystemD1WorkflowAdapter({ ...c.context, decisionGuards: prepared.guards }),
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
      new SystemD1WorkflowAdapter({ ...c.context, decisionGuards: prepared.guards }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at }),
  ).toBeInstanceOf(Error)
  expect(await c.prepare(c.first)).toBeInstanceOf(CompanyForbiddenError)
  expect(await c.query.listAttestations(c.started.workflowCase.id)).toEqual([])
  expect(await c.query.listTasks(c.started.workflowCase.id)).toHaveLength(1)
})
