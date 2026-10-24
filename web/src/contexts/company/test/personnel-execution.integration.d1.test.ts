import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { RevalidatePersonnelActionExecutionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/revalidate-personnel-action-execution.adapter"
import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"
import type { PersonnelActionRequestRecord } from "@/contexts/company/domain/definitions/personnel-action-request-record.definition"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { createSystemDecisionTask } from "@system/domain/policies/decision-task.policy"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function createFixture(delegated = false) {
  const c = await createGovernanceTaskTestContext()
  const assignment = c.resources.find((resource) => resource.type === "responsibility-assignment")
  const responsibility = c.resources.find((resource) => resource.type === "responsibility")
  const target = c.people[1]
  const first = c.people[2]
  const last = c.people[3]
  if (
    assignment === undefined ||
    responsibility === undefined ||
    target === undefined ||
    first === undefined ||
    last === undefined
  )
    throw new Error("execution fixture is missing")
  const firstAssignment = {
    ...assignment,
    revision: 2,
    attributes: {
      ...assignment.attributes,
      holderType: "employee",
      holderId: first.employeeId,
      authorityScopeId: null,
      delegationAllowed: true,
    },
  }
  await c.write([
    firstAssignment,
    {
      ...responsibility,
      id: "responsibility:final",
      attributes: { code: "FINAL", officialName: "Final approval" },
    },
    {
      ...assignment,
      id: "assignment:final",
      attributes: {
        ...assignment.attributes,
        responsibilityId: "responsibility:final",
        holderType: "employee",
        holderId: last.employeeId,
        authorityScopeId: null,
      },
    },
  ])
  const steps: ApplicationWorkflowStep[] = ["APPROVE", "FINAL"].map((code) => ({
    ...c.step,
    key: code,
    governance_authority: {
      organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
      responsibility_code: code,
      scope: null,
    },
  }))
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps },
  })
  if (policy instanceof Error) throw policy
  const definition = ProcedureDefinitionEntity.create({
    key: "personnel_action_request",
    revision: 1,
    title: "Personnel request",
    category: "company",
    description: null,
    inputSchema: { fields: [] },
    decisionPolicy: policy,
    completionOperationKey: "company.personnel-action.apply",
    createdByAccountId: c.creator.accountId,
    createdAt: c.at,
  })
  if (definition instanceof Error) throw definition
  const published = await new SystemD1ProcedureRepository(c.context).publish(definition, 0)
  if (published !== true) throw published
  const action: PersonnelActionRequestRecord["action"] = {
    kind: "leave_started",
    employeeCode: "SUBJECT",
    eventOn: assignment.effectiveFrom,
  }
  const resolved = []
  for (const step of steps) {
    const task = await new ResolveCompanyGovernanceTaskAdapter(c.context).resolve({
      step,
      payload: action,
      subjectEmployeeId: target.employeeId,
      excludedEmployeeIds: new Set([target.employeeId, c.creator.employeeId]),
      openedAt: c.at,
      dueAt: null,
      resolvedAt: c.at,
    })
    if (task instanceof Error) throw task
    resolved.push(task.task)
  }
  const firstTask = resolved[0]
  const finalTask = resolved[1]
  if (firstTask === undefined || finalTask === undefined)
    throw new Error("execution tasks are missing")
  const writer = new SystemD1WorkflowAdapter(c.context)
  const started = await new StartSystemProcedure({ writer }).run({
    seriesId: crypto.randomUUID(),
    version: 1,
    procedureKey: definition.key,
    procedureRevision: 1,
    body: action,
    createdByAccountId: c.creator.accountId,
    supersedesProposalId: null,
    createdAt: c.at,
    firstTask,
  })
  if (started instanceof Error) throw started
  const next = createSystemDecisionTask({
    task: finalTask,
    caseId: started.workflowCase.id,
    createdByAccountId: c.creator.accountId,
    proposalDigest: started.proposal.digest,
  })
  if (next instanceof Error) throw next
  if (delegated) {
    await c.database
      .prepare(`INSERT INTO system_delegations
      (id, delegator_account_id, delegate_account_id, scope_context, scope_kind, scope_id, scope_version,
       starts_at, ends_at, created_at, revoked_at)
      VALUES ('31d1558e-cfb2-420b-8201-a3ba4e6b1f45', ?1, ?2, NULL, NULL, NULL, NULL, ?3, ?4, ?3, NULL)`)
      .bind(first.accountId, last.accountId, c.at.getTime(), c.at.getTime() + 60_000)
      .run()
  }
  for (const task of [firstTask, finalTask]) {
    const represented = task.key === firstTask.key ? first : last
    const approved = await new ApproveSystemTask(writer).execute({
      caseId: started.workflowCase.id,
      taskKey: task.key,
      round: 1,
      actorAccountId: delegated ? last.accountId : represented.accountId,
      representedAccountId: represented.accountId,
      delegationId:
        delegated && represented === first ? "31d1558e-cfb2-420b-8201-a3ba4e6b1f45" : null,
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: c.at,
      nextTask: task.key === firstTask.key ? next : null,
    })
    if (approved instanceof Error) throw approved
  }
  const request: PersonnelActionRequestRecord = {
    id: crypto.randomUUID(),
    applicationId: started.number,
    systemProposalSeriesId: started.proposal.seriesId,
    systemCaseId: started.workflowCase.id,
    proposalDigest: started.proposal.digest,
    targetEmployeeId: target.employeeId,
    targetEmployeeCode: "SUBJECT",
    targetEmployeeName: "Subject",
    targetDepartmentCode: null,
    kind: action.kind,
    action,
    payloadFingerprint: "execution-test",
    requestedByEmployeeId: c.creator.employeeId,
    requestedByEmployeeCode: "CREATOR",
    requestedByEmployeeName: "Creator",
    baseEmployeeRevision: 1,
    baseCompanyRevision: null,
    baseOrganizationRevision: null,
    status: "approved",
    currentStep: null,
    createdAt: c.at.getTime(),
    appliedActionId: null,
    withdrawnAt: null,
  }
  const session: CompanyPersonnelSession = {
    accountId: last.accountId,
    employeeId: last.employeeId,
    hasPermission: () => false,
  }
  return {
    ...c,
    firstAssignment,
    request,
    session,
    validator: new RevalidatePersonnelActionExecutionAdapter(c.context),
  }
}

describe("人事発令の全段階の実行資格", () => {
  test("承認者のPrincipalが欠落した場合は、保存済みの承認を人事実行へ使用しない", async () => {
    const c = await createFixture()
    const input = { request: c.request, session: c.session, executedAt: c.at }
    const valid = await c.validator.prepare(input)
    if (valid instanceof Error) throw valid
    await c.database
      .prepare("DELETE FROM system_principals WHERE account_id = ?1")
      .bind(c.session.accountId)
      .run()
    const saved = await c.database.batch([...valid]).then(
      () => null,
      (cause: unknown) => cause,
    )
    expect(saved).toBeInstanceOf(Error)
    expect(await c.validator.prepare(input)).toBeInstanceOf(CompanyForbiddenError)
  })
  test.each([false, true])(
    "全段階の有効な承認を受け付け、最終段階以外の失効も拒否する: delegation=%s",
    async (delegated) => {
      const c = await createFixture(delegated)
      const input = { request: c.request, session: c.session, executedAt: c.at }
      const valid = await c.validator.prepare(input)
      if (valid instanceof Error) throw valid
      await c.database.batch([...valid])
      if (delegated)
        await c.database
          .prepare(
            "UPDATE system_delegations SET revoked_at = ?1 WHERE id = '31d1558e-cfb2-420b-8201-a3ba4e6b1f45'",
          )
          .bind(c.at.getTime())
          .run()
      else await c.write([{ ...c.firstAssignment, revision: 3, state: "void" }])
      const conflict = await c.database.batch([...valid]).then(
        () => null,
        (cause: unknown) => cause,
      )
      expect(conflict).toBeInstanceOf(Error)
      expect(await c.validator.prepare(input)).toBeInstanceOf(CompanyForbiddenError)
    },
  )

  test("承認対象と違う内容・digest・Case・seriesは実行しない", async () => {
    const c = await createFixture()
    const requests = [
      { ...c.request, action: { ...c.request.action, employeeCode: "ANOTHER" } },
      { ...c.request, proposalDigest: "0".repeat(64) },
      { ...c.request, systemCaseId: "another-case" },
      { ...c.request, systemProposalSeriesId: "another-series" },
    ]
    for (const request of requests) {
      expect(
        await c.validator.prepare({ request, session: c.session, executedAt: c.at }),
      ).toBeInstanceOf(CompanyForbiddenError)
    }
  })
})
