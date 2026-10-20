import { createProcedureCandidatesTestContext } from "@/contexts/company/test/procedure-candidates.test-support"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { StartSystemProcedure } from "@system/application/workflow/start-system-procedure"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import { SystemD1ProcedureRepository } from "@system/infrastructure/repositories/workflow/system-d1-procedure.repository"
import { SystemD1ProposalAdapter } from "@system/infrastructure/adapters/workflow/system-d1-proposal.adapter"
import { ApproveSystemTask } from "@system/application/workflow/approve-system-task"
import { SystemD1WorkflowAdapter } from "@system/infrastructure/adapters/workflow/system-d1-workflow.adapter"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("Company Taskの判断時点の資格", () => {
  test("旧Account対応を撤去しても公開対応先の従業員変更を保存時に検知する", async () => {
    const fixture = await createExternalIdentityImportTestContext()
    expect((await fixture.application.execute(fixture.input)).kind).toBe("applied")
    const database = fixture.database
    const link = await database
      .prepare("SELECT account_id, employee_id FROM company_account_employee_resource_bindings")
      .first<{ account_id: string; employee_id: string }>()
    if (link === null) throw new Error("public Account correspondence missing")
    await execSql(database, "DROP TRIGGER IF EXISTS company_account_employee_links_delete_guard")
    await database
      .prepare("DELETE FROM company_account_employee_links WHERE account_id = ?1")
      .bind(link.account_id)
      .run()
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({ database }).prepare({
      employeeCodes: [],
      accountIds: [zAccountId.parse(link.account_id)],
    })
    if (guard instanceof Error) throw guard
    await database
      .prepare(`UPDATE company_workforce_resource_bindings
        SET lifecycle_revision = lifecycle_revision + 1
        WHERE resource_type = 'employee' AND employee_id = ?1`)
      .bind(link.employee_id)
      .run()
    expect(
      await database.batch([guard]).then(
        () => null,
        (cause: unknown) => cause,
      ),
    ).toBeInstanceOf(Error)
  })

  test("両製品の実migrationで、従業員指定の再検査と保存時の変更検知を行う", async () => {
    const fixture = await createExternalIdentityImportTestContext()
    expect((await fixture.application.execute(fixture.input)).kind).toBe("applied")
    const database = fixture.database
    await database.prepare("UPDATE company_employees SET employee_code = 'REVIEWER'").run()
    const accountId = zAccountId.parse(
      await database
        .prepare("SELECT account_id FROM company_account_employee_links")
        .first<string>("account_id"),
    )
    const changeCode = async (employeeCode: string) => {
      const asOf = resolveCompanyBusinessDate({
        now: fixture.clock.at.toISOString(),
        timeZone: "Asia/Tokyo",
      })
      if (asOf instanceof Error) throw asOf
      const repository = new D1CompanyResourceRepository({ database })
      const snapshot = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: ["employee"],
        effectiveOn: asOf,
      })
      if (!snapshot.ok) throw new Error("employee snapshot unavailable")
      const employee = snapshot.resources[0]
      if (employee === undefined) throw new Error("employee missing")
      const change = CompanyResourceChangeEntity.create({
        commandId: crypto.randomUUID(),
        expectedRevision: snapshot.organizationRevision,
        actorAccountId: fixture.actor.accountId,
        reason: "Confirm employee code",
        recordedAt: fixture.clock.at.getTime(),
        resources: [
          {
            organizationId: employee.organizationId,
            type: employee.type,
            id: employee.id,
            revision: employee.revision + 1,
            state: employee.state,
            effectiveFrom: employee.effectiveFrom,
            effectiveTo: employee.effectiveTo,
            attributes: { ...employee.attributes, employeeCode },
          },
        ],
      })
      if (change instanceof Error) throw change
      expect((await repository.write(change)).kind).toBe("applied")
    }
    const step: ApplicationWorkflowStep = {
      key: "review",
      name: "Review",
      approvers: [{ type: "employee", employee_code: "REVIEWER" }],
      approval_mode: "any",
      condition_mode: "all",
      conditions: [],
      due_days: null,
      escalation_approvers: [],
      rejection_behavior: "reject",
      allow_delegation: true,
    }
    const resolver = new RevalidateCompanyProcedureAuthorityAdapter({
      env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
      var: {
        database: drizzle(database),
        auditContext: {
          requestId: "authority-test",
          clientName: "api",
          clientIp: null,
          externalRequestId: null,
        },
      },
    })
    const input = {
      step,
      representedAccountId: accountId,
      subjectEmployeeId: null,
      targetDepartmentCode: null,
      excludedEmployeeIds: new Set<never>(),
      dueAt: null,
      decidedAt: fixture.clock.at,
    }
    // 投影tableだけを書き換えても公開履歴にないcodeでは判断できない。
    expect(await resolver.revalidate(input)).toBeInstanceOf(Error)
    await changeCode("REVIEWER")
    expect(await resolver.revalidate(input)).toBe(true)
    const guard = await new CompanyAuthoritySnapshotGuardAdapter({ database }).prepare({
      employeeCodes: ["REVIEWER"],
      accountIds: [accountId],
    })
    if (guard instanceof Error) throw guard
    expect(await database.batch([guard])).toBeArray()
    await changeCode("REPLACED")
    expect(await resolver.revalidate(input)).toBeInstanceOf(Error)
    const failure = await database
      .batch([
        database.prepare("UPDATE company_employees SET official_name = 'Uncommitted Name'"),
        guard,
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(failure).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT official_name FROM company_employees")
        .first<string>("official_name"),
    ).toBe("Example Person")
  })
})

/** 通常の経路で最初の段階を解決し、公開した手続として開始する。 */
async function startNormalProcedure(step: ApplicationWorkflowStep) {
  const c = await createProcedureCandidatesTestContext()
  const policy = createCompanyProcedureDecisionPolicy({
    approverRoles: [],
    workflow: { version: 1, steps: [step] },
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
  const resolved = await new ResolveCompanyProcedureTaskAdapter({
    c: c.context,
    policy,
    payload: {},
    applicant: {
      employeeId: c.creator.employeeId,
      employeeCode: "APPLICANT",
      employmentStatus: null,
      organizationUnitId: null,
      organizationUnitCode: null,
      organizationUnitName: null,
      positionTitle: null,
    },
    activatedAt: c.at,
    afterTaskKey: null,
  }).resolveCompanyProcedureTask()
  if (resolved instanceof Error || resolved === null) throw resolved ?? new Error("task missing")
  const other = c.people[2]
  if (other === undefined) throw new Error("second reviewer missing")
  const writer = new SystemD1WorkflowAdapter({ ...c.context, startGuards: resolved.guards })
  const started = await new StartSystemProcedure({ writer }).run({
    seriesId: crypto.randomUUID(),
    version: 1,
    procedureKey: definition.key,
    procedureRevision: 1,
    body: {},
    createdByAccountId: c.creator.accountId,
    supersedesProposalId: null,
    createdAt: c.at,
    firstTask: resolved.task,
    subject: { context: "company", kind: "review", id: crypto.randomUUID(), version: "1" },
  })
  if (started instanceof Error) throw started
  const approve = (accountId: typeof other.accountId) =>
    new ApproveSystemTask(writer).execute({
      caseId: started.workflowCase.id,
      taskKey: step.key,
      round: 1,
      actorAccountId: accountId,
      representedAccountId: accountId,
      delegationId: null,
      proposalDigest: started.proposal.digest,
      comment: null,
      decidedAt: c.at,
      nextTask: null,
    })
  return { c, other, task: resolved.task, started, approve }
}

test.each([
  { dueDays: 1, selector: "employee" },
  { dueDays: 1, selector: "responsibility" },
  { dueDays: null, selector: "employee" },
  { dueDays: 1, selector: "distinct" },
])("normal candidates start and approve before deadline: %j", async (scenario) => {
  const { c, other, task, approve } = await startNormalProcedure({
    key: "review",
    name: "Review",
    approvers: [{ type: "employee", employee_code: "REVIEWER_1" }],
    escalation_approvers:
      scenario.selector === "responsibility"
        ? [{ type: "responsibility", responsibility_type: "APPROVE", organization_unit_code: null }]
        : [
            {
              type: "employee",
              employee_code: scenario.selector === "distinct" ? "REVIEWER_2" : "REVIEWER_1",
            },
          ],
    due_days: scenario.dueDays,
    approval_mode: "any",
    condition_mode: "all",
    conditions: [],
    rejection_behavior: "reject",
    allow_delegation: true,
  })
  const expected: Pick<
    (typeof task.candidates)[number],
    "accountId" | "source" | "eligibleFrom"
  >[] = [{ accountId: c.reviewer.accountId, source: "primary", eligibleFrom: null }]
  if (scenario.selector === "distinct")
    expected.push({ accountId: other.accountId, source: "escalation", eligibleFrom: task.dueAt })
  expect(
    task.candidates.map((candidate) => ({
      accountId: candidate.accountId,
      source: candidate.source,
      eligibleFrom: candidate.eligibleFrom,
    })),
  ).toEqual(expected)
  const approved = await approve(c.reviewer.accountId)
  if (approved instanceof Error) throw approved
  expect(approved.caseStatus).toBe("approved")
})

test("a candidate consolidated from normal and escalation selectors holds a single vote", async () => {
  const { c, other, task, started, approve } = await startNormalProcedure({
    key: "review",
    name: "Review",
    approvers: [
      { type: "employee", employee_code: "REVIEWER_1" },
      { type: "employee", employee_code: "REVIEWER_2" },
    ],
    escalation_approvers: [
      { type: "employee", employee_code: "REVIEWER_1" },
      { type: "responsibility", responsibility_type: "APPROVE", organization_unit_code: null },
    ],
    due_days: 1,
    approval_mode: "all",
    condition_mode: "all",
    conditions: [],
    rejection_behavior: "reject",
    allow_delegation: true,
  })
  expect(task.requiredApprovals).toBe(2)
  expect(task.candidates.map((candidate) => candidate.accountId)).toEqual([
    c.reviewer.accountId,
    other.accountId,
  ])
  const first = await approve(c.reviewer.accountId)
  if (first instanceof Error) throw first
  expect(first.caseStatus).toBe("pending")
  // 段階が開いたままでも、統合した候補の二票目は保存されない。
  expect(await approve(c.reviewer.accountId)).toBeInstanceOf(Error)
  const votes = await new SystemD1ProposalAdapter(c.context).listAttestations(
    started.workflowCase.id,
  )
  if (votes instanceof Error) throw votes
  expect(votes.map((vote) => vote.representedAccountId)).toEqual([c.reviewer.accountId])
  const second = await approve(other.accountId)
  if (second instanceof Error) throw second
  expect(second.caseStatus).toBe("approved")
})
