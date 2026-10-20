import { expect, setDefaultTimeout, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import { PrepareCompanyProcedureDecisionAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-procedure-decision.adapter"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { CompanyForbiddenError, CompanyOperationError } from "@/contexts/company/domain/errors"
import { SystemD1ProcedureDelegationAdapter } from "@system/infrastructure/adapters/workflow/system-d1-procedure-delegation.adapter"
import { PrepareCompanyRecordDecisionReplayAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-company-record-decision-replay.adapter"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(firstStartsLater = true, singleDelegation = false) {
  const c = await createGovernanceTaskTestContext()
  const first = c.people[1]
  const second = c.people[2]
  if (first === undefined || second === undefined) throw new Error("reviewers missing")
  const delegate = c.people[3]
  if (delegate === undefined) throw new Error("delegate missing")
  const assignment = c.resources.find((resource) => resource.id === "assignment:approve")
  const membership = c.resources.find((resource) => resource.id === "membership:2")
  if (assignment === undefined || membership === undefined) throw new Error("resources missing")
  await c.write([
    {
      ...assignment,
      revision: 2,
      attributes: { ...assignment.attributes, delegationAllowed: true },
    },
    { ...membership, revision: 2, attributes: { ...membership.attributes, voting: false } },
  ])
  const delegations = new SystemD1ProcedureDelegationAdapter(c.context)
  const createDelegation = async (person: typeof first, offset: number) => {
    const result = await delegations.create({
      delegatorAccountId: person.accountId,
      delegateAccountId: delegate.accountId,
      procedureKey: null,
      startsAt: new Date(c.at.getTime() - offset),
      endsAt: new Date(c.at.getTime() + 600_000),
      createdAt: new Date(c.at.getTime() - 2000),
    })
    if (result instanceof Error || result === "overlap") throw new Error("delegation setup failed")
    return result
  }
  const firstDelegation = singleDelegation
    ? null
    : await createDelegation(first, firstStartsLater ? 500 : 1000)
  const secondDelegation = await createDelegation(second, firstStartsLater ? 1000 : 500)
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
  return {
    ...c,
    first,
    second,
    delegate,
    firstDelegation,
    secondDelegation,
    read,
    prepare,
    approve,
    finalStep,
    query,
    started,
  }
}

test.each([{ decidedDelegatorStartsLater: true }, { decidedDelegatorStartsLater: false }])(
  "判断済み委任元を除き未判断の委任元を代表して保存する: %j",
  async (scenario) => {
    const c = await fixture(scenario.decidedDelegatorStartsLater)
    expect((await c.approve(c.first)).caseStatus).toBe("pending")
    expect((await c.approve(c.delegate)).caseStatus).toBe("pending")
    const attestations = await c.query.listAttestations(c.started.workflowCase.id)
    if (attestations instanceof Error) throw attestations
    expect(attestations.find((vote) => vote.actorAccountId === c.delegate.accountId)).toMatchObject(
      {
        representedAccountId: c.second.accountId,
        delegationId: c.secondDelegation.id,
        taskKey: c.step.key,
        round: 1,
      },
    )
  },
)

test("唯一の委任元が本人として判断済みなら、開いている段階でも代理の判断資格を認めない", async () => {
  const c = await fixture(true, true)
  expect((await c.approve(c.second)).caseStatus).toBe("pending")
  const current = await c.read()
  expect(current.currentTaskKey).toBe(c.step.key)
  expect(await c.prepare(c.delegate)).toBeInstanceOf(CompanyForbiddenError)
  const votes = await c.query.listAttestations(c.started.workflowCase.id)
  if (votes instanceof Error) throw votes
  expect(votes.map((vote) => vote.representedAccountId)).toEqual([c.second.accountId])
})

test("代理人は未判断の委任元が残っていても同じ段階へ二票目を保存できない", async () => {
  const c = await fixture()
  expect((await c.approve(c.delegate)).caseStatus).toBe("pending")
  const prepared = await c.prepare(c.delegate)
  if (prepared instanceof CompanyOperationError) throw prepared
  // 委任は未判断の委任元から選ばれるが、代理人自身の票は段階ごとに一つしか保存されない。
  expect(prepared.representedAccountId).toBe(c.second.accountId)
  expect(
    await new ApproveSystemTask(
      new SystemD1WorkflowAdapter({ ...c.context, decisionGuards: prepared.guards }),
    ).execute({ ...prepared, comment: null, decidedAt: c.at }),
  ).toBeInstanceOf(Error)
  const votes = await c.query.listAttestations(c.started.workflowCase.id)
  if (votes instanceof Error) throw votes
  expect(votes.map((vote) => vote.actorAccountId)).toEqual([c.delegate.accountId])
})

test("保存済み代理判断は委任元の後続本人判断後も元の委任と照合する", async () => {
  const c = await fixture(true, true)
  await c.approve(c.first)
  await c.approve(c.delegate)
  const votes = await c.query.listAttestations(c.started.workflowCase.id)
  if (votes instanceof Error) throw votes
  const original = votes.find((vote) => vote.actorAccountId === c.delegate.accountId)
  if (original === undefined) throw new Error("delegated decision missing")
  const replay = new PrepareCompanyRecordDecisionReplayAdapter(c.context)
  const before = await replay.prepare({ proposal: await c.read(), attestation: original, at: c.at })
  expect(before).not.toBeInstanceOf(Error)
  // 同じ段階の二重判断は禁止されるため、委任元の本人判断は後続段階で保存する。
  await c.approve(c.second)
  const after = await replay.prepare({ proposal: await c.read(), attestation: original, at: c.at })
  expect(after).not.toBeInstanceOf(Error)
  expect(
    await c.query.findDelegation({
      caseId: c.started.workflowCase.id,
      taskKey: original.taskKey,
      round: original.round,
      actorAccountId: original.actorAccountId,
      candidateAccountIds: [original.representedAccountId],
      delegationId: original.delegationId ?? undefined,
      at: c.at,
    }),
  ).toEqual({ id: c.secondDelegation.id, representedAccountId: c.second.accountId })
})

test("単一の委任と本人判断を維持する", async () => {
  const c = await fixture(true, true)
  const prepared = await c.prepare(c.first)
  if (prepared instanceof CompanyOperationError) throw prepared
  expect(prepared.representedAccountId).toBe(c.first.accountId)
  expect(prepared.delegationId).toBeNull()
  await c.approve(c.first)
  await c.approve(c.delegate)
  const votes = await c.query.listAttestations(c.started.workflowCase.id)
  if (votes instanceof Error) throw votes
  expect(
    votes.map((vote) => ({ actor: vote.actorAccountId, represented: vote.representedAccountId })),
  ).toEqual(
    expect.arrayContaining([
      { actor: c.first.accountId, represented: c.first.accountId },
      { actor: c.delegate.accountId, represented: c.second.accountId },
    ]),
  )
})
