import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import * as myDirectReports from "@/contexts/company/interface/routes/company.my-direct-reports"
import * as reportingLines from "@/contexts/company/interface/routes/company.reporting-lines.$employeeCode"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { ResolveOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organization-authority.adapter"
import { PrepareEmployeeManagementAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/prepare-employee-management-authority.adapter"
import { ResolveCanonicalOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/workforce/resolve-canonical-organization-authority.adapter"
import { ResolveOrganizationalAuthorityCandidatesAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organizational-authority-candidates.adapter"
import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"
import { ResolveCompanyProcedureApproverMatchesAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-approver-matches.adapter"
import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"
import { createCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/company-procedure-decision.policy"
import { zApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import * as organizationChanges from "@/contexts/company/interface/routes/company.organization-changes"
import * as organizationAdoptions from "@/contexts/company/interface/routes/company.organization-resource-adoptions"
import * as organizationSnapshots from "@/contexts/company/interface/routes/company.organization-snapshots"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const relationSchema = z.object({
  organizationId: z.string(),
  type: z.literal("reporting-relation"),
  id: z.string(),
  revision: z.number(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  attributes: z.object({
    employeeId: z.string(),
    managerEmployeeId: z.string(),
    organizationUnitId: z.string(),
  }),
})
type Relation = z.infer<typeof relationSchema>

async function fixture() {
  const base = await createGovernanceTaskTestContext()
  let actor = CompanyActorValue.restore({
    accountId: base.creator.accountId,
    employeeId: base.creator.employeeId,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  let now = base.at
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set("companyActor", actor)
    context.set("companyClock", () => now)
    context.set("database", base.context.var.database)
    context.set("auditContext", base.context.var.auditContext)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  const routes = app
    .get("/organization-resource-adoptions", ...organizationAdoptions.GET)
    .post("/organization-resource-adoptions", ...organizationAdoptions.POST)
    .post("/organization-changes", ...organizationChanges.POST)
    .get("/organization-snapshots", ...organizationSnapshots.GET)
    .get("/my-direct-reports", ...myDirectReports.GET)
    .get("/reporting-lines/:employeeCode", ...reportingLines.GET)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, base.context.env),
      { preconnect: fetch.preconnect },
    ),
  })
  const root = await base.database
    .prepare(
      "SELECT organization_unit_id AS id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<{ id: string }>()
  if (root === null) throw new Error("organization root missing")
  const previewResponse = await client["organization-resource-adoptions"].$get({
    query: { organization_unit_id: root.id },
  })
  expect(Number(previewResponse.status)).toBe(200)
  const preview = z
    .object({ expectedRevision: z.number(), snapshotDigest: z.string(), observedOn: z.string() })
    .parse(await previewResponse.json())
  const connected = await client["organization-resource-adoptions"].$post({
    header: { "idempotency-key": "connect-root" },
    json: {
      ...preview,
      organizationUnitId: root.id,
      reason: "Confirm organization history",
      initializationConfirmation: {
        startsOn: "2020-01-01",
        evidenceReferences: [
          { context: "company", kind: "confirmed-test-history", id: "root-start", version: "1" },
        ],
      },
    },
  })
  expect(Number(connected.status)).toBe(201)
  const revision = await base.database
    .prepare(
      `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .first<number>("revision")
  if (revision === null) throw new Error("organization revision missing")
  const write = (resources: Relation[], key: string, expectedRevision = revision) =>
    client["organization-changes"].$post({
      header: {
        "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
        "if-match": String(expectedRevision),
        "idempotency-key": key,
      },
      json: { reason: "Confirm reporting lines", resources },
    })
  const employee = (index: number) => {
    const person = base.people[index]
    if (person === undefined) throw new Error("employee fixture missing")
    return person.employeeId
  }
  const relation = (id: string, employeeIndex: number, managerIndex: number): Relation => ({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "reporting-relation",
    id,
    revision: 1,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: {
      employeeId: employee(employeeIndex),
      managerEmployeeId: employee(managerIndex),
      organizationUnitId: root.id,
    },
  })
  const persisted = () =>
    base.database
      .prepare(`SELECT
        (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS revision,
        (SELECT COUNT(*) FROM company_resource_revisions) AS resources,
        (SELECT COUNT(*) FROM company_command_receipts) AS receipts`)
      .first<{ revision: number; resources: number; receipts: number }>()
  const readRelations = async (date: string) => {
    const response = await client["organization-snapshots"].$get({
      header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
      query: { as_of: date },
    })
    expect(Number(response.status)).toBe(200)
    const snapshot = z
      .object({ resources: z.array(z.object({ type: z.string() }).passthrough()) })
      .parse(await response.json())
    return snapshot.resources
      .filter((resource) => resource.type === "reporting-relation")
      .map((resource) => relationSchema.parse(resource))
  }
  const context = { ...base.context, env: { ...base.context.env, NOW: "2030-06-01T00:00:00Z" } }
  const candidates = (asOf: string) =>
    new ResolveCanonicalOrganizationAuthorityAdapter({
      c: context,
      subjectEmployeeId: base.people[0]!.employeeId,
      criteria: [{ kind: "direct_manager" }],
      employeeRows: base.people.map((person) => ({ id: person.employeeId, code: null })),
      targetDepartmentCode: null,
      asOf,
    }).resolveCanonicalOrganizationAuthority()
  return {
    client,
    setNow: (date: string) => {
      now = new Date(`${date}T00:00:00Z`)
    },
    setActor: (value: CompanyActorValue) => {
      actor = value
    },
    writeResources: base.write,
    write,
    relation,
    persisted,
    revision,
    readRelations,
    database: base.database,
    people: base.people,
    context,
    candidates,
  }
}

describe("Company reporting graph through organization changes", () => {
  test("管理資格の準備は本人対応を確認し、確認後の上長関係の終了を保存時に拒否する", async () => {
    const f = await fixture()
    const subject = f.people[0]!
    const manager = f.people[1]!
    const outsider = f.people[2]!
    const relation = f.relation("report:decision", 0, 1)
    expect(Number((await f.write([relation], "decision-manager")).status)).toBe(201)
    const adapter = new PrepareEmployeeManagementAuthorityAdapter(f.context)
    const command = {
      accountId: manager.accountId,
      actorEmployeeId: manager.employeeId,
      subjectEmployeeId: subject.employeeId,
    }
    const prepared = await adapter.prepare(command)
    if (prepared instanceof Error || prepared === null)
      throw new Error("manager authority missing", { cause: prepared })
    expect(prepared.snapshot).toMatchObject({ asOf: "2030-06-01" })
    expect((await prepared.guard.run()).success).toBe(true)
    expect(await adapter.prepare({ ...command, accountId: outsider.accountId })).toBeNull()
    expect(
      await adapter.prepare({
        ...command,
        accountId: outsider.accountId,
        actorEmployeeId: outsider.employeeId,
      }),
    ).toBeNull()
    expect(await adapter.prepare({ ...command, subjectEmployeeId: manager.employeeId })).toBeNull()
    await f.writeResources([
      {
        ...relation,
        revision: 2,
        effectiveFrom: restoreCalendarDate(relation.effectiveFrom),
        effectiveTo: restoreCalendarDate("2030-06-01"),
      },
    ])
    expect(await prepared.guard.run().catch((cause: unknown) => cause)).toBeInstanceOf(Error)
    expect(await adapter.prepare(command)).toBeNull()
  })

  test("管理資格の準備は将来の関係を先取りせず、有効開始日に解決する", async () => {
    const f = await fixture()
    const subject = f.people[0]!
    const manager = f.people[1]!
    expect(
      Number(
        (
          await f.write(
            [{ ...f.relation("report:future-decision", 0, 1), effectiveFrom: "2030-06-02" }],
            "future-decision-manager",
          )
        ).status,
      ),
    ).toBe(201)
    const command = {
      accountId: manager.accountId,
      actorEmployeeId: manager.employeeId,
      subjectEmployeeId: subject.employeeId,
    }
    expect(
      await new PrepareEmployeeManagementAuthorityAdapter(f.context).prepare(command),
    ).toBeNull()
    const prepared = await new PrepareEmployeeManagementAuthorityAdapter({
      ...f.context,
      env: { ...f.context.env, NOW: "2030-06-02T00:00:00Z" },
    }).prepare(command)
    if (prepared instanceof Error || prepared === null)
      throw new Error("effective manager authority missing", { cause: prepared })
    expect(prepared.snapshot).toMatchObject({ asOf: "2030-06-02" })
    expect((await prepared.guard.run()).success).toBe(true)
  })

  test("parallel managers and uncoded employees appear in owner reports and the complete reporting graph", async () => {
    const f = await fixture()
    const relations = [
      f.relation("report:01", 0, 1),
      f.relation("report:02", 0, 2),
      f.relation("report:13", 1, 3),
      f.relation("report:23", 2, 3),
    ]
    expect(Number((await f.write(relations, "matrix-read")).status)).toBe(201)
    f.setNow("2030-06-01")
    for (const [manager, reportIndexes] of [
      [0, []],
      [1, [0]],
      [2, [0]],
      [3, [1, 2]],
    ] satisfies Array<[number, number[]]>) {
      const person = f.people[manager]!
      f.setActor(
        CompanyActorValue.restore({
          ...person,
          organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
          capabilities: ["company:read"],
        }),
      )
      const response = await f.client["my-direct-reports"].$get()
      expect(Number(response.status)).toBe(200)
      const body = z
        .object({
          data: z.array(z.object({ employee_id: z.string(), code: z.null(), dept_name: z.null() })),
        })
        .parse(await response.json())
      expect(body.data.map((row) => row.employee_id).toSorted()).toEqual(
        reportIndexes.map((index) => f.people[index]!.employeeId).toSorted(),
      )
    }
    const response = await f.client["reporting-lines"][":employeeCode"].$get({
      param: { employeeCode: f.people[0]!.employeeId },
    })
    expect(Number(response.status)).toBe(200)
    const nodes = z
      .array(
        z.object({
          employee_id: z.string(),
          employee_code: z.null(),
          department_code: z.null(),
          depth: z.number(),
          manager_employee_ids: z.array(z.string()),
        }),
      )
      .parse(await response.json())
    expect(nodes).toHaveLength(4)
    for (const [index, depth, managers] of [
      [0, 0, [1, 2]],
      [1, 1, [3]],
      [2, 1, [3]],
      [3, 2, []],
    ] satisfies Array<[number, number, number[]]>) {
      expect(nodes.find((node) => node.employee_id === f.people[index]!.employeeId)).toMatchObject({
        depth,
        manager_employee_ids: managers.map((manager) => f.people[manager]!.employeeId).toSorted(),
      })
    }
    for (const denied of [
      { organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID], capabilities: [] },
      { organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"], capabilities: ["company:read"] },
    ] satisfies Array<
      Pick<Parameters<typeof CompanyActorValue.restore>[0], "organizationIds" | "capabilities">
    >) {
      f.setActor(CompanyActorValue.restore({ ...f.people[0]!, ...denied }))
      expect(Number((await f.client["my-direct-reports"].$get()).status)).toBe(403)
      expect(
        Number(
          (
            await f.client["reporting-lines"][":employeeCode"].$get({
              param: { employeeCode: f.people[0]!.employeeId },
            })
          ).status,
        ),
      ).toBe(403)
    }
  })

  test("reporting reads and code selectors use the requested date rather than a future employee code", async () => {
    const f = await fixture()
    expect(
      Number((await f.write([f.relation("report:profile", 0, 1)], "profile-read")).status),
    ).toBe(201)
    const snapshot = await new D1CompanyResourceRepository({ database: f.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["employee"],
      effectiveOn: restoreCalendarDate("2030-06-01"),
    })
    if (!snapshot.ok) throw new Error("employee snapshot unavailable")
    const manager = snapshot.resources.find((employee) => employee.id === f.people[1]!.employeeId)
    if (manager === undefined) throw new Error("employee missing")
    await f.writeResources([
      {
        organizationId: manager.organizationId,
        type: manager.type,
        id: manager.id,
        state: manager.state,
        effectiveTo: manager.effectiveTo,
        revision: manager.revision + 1,
        effectiveFrom: restoreCalendarDate("2030-07-01"),
        attributes: { ...manager.attributes, employeeCode: "MANAGER-FUTURE" },
      },
    ])
    for (const [date, expectedCode] of [
      ["2030-06-01", null],
      ["2030-08-01", "MANAGER-FUTURE"],
    ] satisfies Array<[string, string | null]>) {
      f.setNow(date)
      const response = await f.client["reporting-lines"][":employeeCode"].$get({
        param: { employeeCode: f.people[0]!.employeeId },
      })
      expect(Number(response.status)).toBe(200)
      const nodes = z
        .array(z.object({ employee_id: z.string(), employee_code: z.string().nullable() }))
        .parse(await response.json())
      expect(nodes.find((node) => node.employee_id === manager.id)?.employee_code).toBe(
        expectedCode,
      )
      const byCode = await f.client["reporting-lines"][":employeeCode"].$get({
        param: { employeeCode: "MANAGER-FUTURE" },
      })
      expect(Number(byCode.status)).toBe(expectedCode === null ? 404 : 200)
      const resolved = await new ResolveOrganizationalAuthorityCandidatesAdapter({
        c: f.context,
        subjectEmployeeId: f.people[0]!.employeeId,
        criteria: [{ kind: "employee", employeeCode: "MANAGER-FUTURE" }],
        resolvedAt: `${date}T00:00:00Z`,
      }).resolveOrganizationalAuthorityCandidates()
      if (expectedCode === null) {
        expect(resolved).toMatchObject({
          code: "organizational_authority_employee_reference_missing",
        })
      } else {
        if (resolved instanceof Error) throw resolved
        expect(resolved.candidates.map((candidate) => candidate.employeeId)).toEqual([
          f.people[1]!.employeeId,
        ])
      }
    }
  })

  test("reporting reads reject a change during directory loading and recover on a fresh read", async () => {
    const f = await fixture()
    const relation = f.relation("report:directory-race", 0, 1)
    expect(Number((await f.write([relation], "directory-initial")).status)).toBe(201)
    f.setNow("2030-06-01")
    const reader = new CompanyEmployeeDirectoryReadAdapter(f.context)
    const read = reader.findForEmployeeIds.bind(reader)
    const raced = spyOn(
      CompanyEmployeeDirectoryReadAdapter.prototype,
      "findForEmployeeIds",
    ).mockImplementation(async (ids) => {
      const result = await read(ids)
      expect(
        Number(
          (
            await f.write(
              [{ ...f.relation(relation.id, 0, 2), revision: 2 }],
              "directory-change",
              f.revision + 1,
            )
          ).status,
        ),
      ).toBe(201)
      return result
    })
    try {
      expect(
        Number(
          (
            await f.client["reporting-lines"][":employeeCode"].$get({
              param: { employeeCode: f.people[0]!.employeeId },
            })
          ).status,
        ),
      ).toBe(503)
    } finally {
      raced.mockRestore()
    }
    const retried = await f.client["reporting-lines"][":employeeCode"].$get({
      param: { employeeCode: f.people[0]!.employeeId },
    })
    expect(Number(retried.status)).toBe(200)
    const nodes = z.array(z.object({ employee_id: z.string() })).parse(await retried.json())
    expect(nodes.map((node) => node.employee_id)).toEqual([
      f.people[0]!.employeeId,
      f.people[2]!.employeeId,
    ])
  })

  test("public reporting relations reach employee management authority", async () => {
    const f = await fixture()
    const relation = f.relation("report:manager", 0, 1)
    expect(Number((await f.write([relation], "authority")).status)).toBe(201)
    const actor = f.people[1]!
    const target = f.people[0]!
    expect(
      await new ResolveOrganizationAuthorityAdapter(f.context).resolveOrganizationAuthority(
        actor.employeeId,
        target.employeeId,
      ),
    ).toEqual({ directManager: true, departmentManager: false, managementChain: true })
  })

  test("public parallel managers reach procedure candidates with their source revisions", async () => {
    const f = await fixture()
    const relations = [f.relation("report:a", 0, 1), f.relation("report:b", 0, 2)]
    expect(Number((await f.write(relations, "candidates")).status)).toBe(201)
    const resolution = await new ResolveCanonicalOrganizationAuthorityAdapter({
      c: f.context,
      subjectEmployeeId: f.people[0]!.employeeId,
      criteria: [{ kind: "direct_manager" }],
      employeeRows: f.people.map((person) => ({ id: person.employeeId, code: null })),
      targetDepartmentCode: null,
      asOf: "2030-06-01",
    }).resolveCanonicalOrganizationAuthority()
    if (resolution instanceof Error) throw resolution
    expect(resolution.candidates.map((candidate) => candidate.employeeId).toSorted()).toEqual(
      [f.people[1]!.employeeId, f.people[2]!.employeeId].toSorted(),
    )
    for (const relation of relations) {
      const candidate = resolution.candidates.find(
        (item) => item.employeeId === relation.attributes.managerEmployeeId,
      )
      expect(candidate?.qualification.evidence).toMatchObject({
        type: "reporting_relation",
        reporting_relation_id: relation.id,
        reporting_relation_revision: 1,
        as_of: "2030-06-01",
      })
    }
  })

  test("candidate history follows future changes, earlier corrections, gaps, and voids", async () => {
    const f = await fixture()
    const original = f.relation("report:history", 0, 1)
    const future = { ...f.relation(original.id, 0, 2), revision: 2, effectiveFrom: "2030-07-01" }
    const correction = {
      ...f.relation(original.id, 0, 3),
      revision: 3,
      effectiveFrom: "2030-03-01",
      effectiveTo: "2030-05-01",
    }
    for (const [index, relation] of [original, future, correction].entries()) {
      expect(
        Number((await f.write([relation], `history-${index}`, f.revision + index)).status),
      ).toBe(201)
    }
    const expected: ReadonlyArray<readonly [string, number | null]> = [
      ["2030-02-01", 1],
      ["2030-04-01", 3],
      ["2030-06-01", null],
      ["2030-08-01", 2],
    ]
    for (const [date, employeeIndex] of expected) {
      const result = await f.candidates(date)
      if (result instanceof Error) throw result
      expect(result.snapshot.companyRevision).toBe(f.revision + 3)
      expect(result.candidates.map((candidate) => candidate.employeeId)).toEqual(
        employeeIndex === null ? [] : [f.people[employeeIndex]!.employeeId],
      )
      f.setNow(date)
      const response = await f.client["reporting-lines"][":employeeCode"].$get({
        param: { employeeCode: f.people[0]!.employeeId },
      })
      expect(Number(response.status)).toBe(200)
      const nodes = z.array(z.object({ employee_id: z.string() })).parse(await response.json())
      expect(nodes.map((node) => node.employee_id)).toEqual([
        f.people[0]!.employeeId,
        ...(employeeIndex === null ? [] : [f.people[employeeIndex]!.employeeId]),
      ])
    }
    expect(
      Number(
        (await f.write([{ ...future, revision: 4, state: "void" }], "void-future", f.revision + 3))
          .status,
      ),
    ).toBe(201)
    const voided = await f.candidates("2030-08-01")
    if (voided instanceof Error) throw voided
    expect(voided.candidates).toEqual([])
    expect(voided.snapshot.companyRevision).toBe(f.revision + 4)
  })

  test("rejects a public revision change while the workforce is being read and allows a fresh retry", async () => {
    const f = await fixture()
    const original = f.relation("report:race", 0, 1)
    expect(Number((await f.write([original], "race-initial")).status)).toBe(201)
    const workforce = new OrganizationWorkforceSnapshotAdapter(f.context)
    const read = workforce.readAllSnapshot.bind(workforce)
    const raced = spyOn(
      OrganizationWorkforceSnapshotAdapter.prototype,
      "readAllSnapshot",
    ).mockImplementation(async () => {
      const result = await read()
      const changed = { ...f.relation(original.id, 0, 2), revision: 2 }
      expect(Number((await f.write([changed], "race-change", f.revision + 1)).status)).toBe(201)
      return result
    })
    try {
      expect(await f.candidates("2030-06-01")).toMatchObject({
        code: "organization_revision_conflict",
      })
    } finally {
      raced.mockRestore()
    }
    const retried = await f.candidates("2030-06-01")
    if (retried instanceof Error) throw retried
    expect(retried.snapshot.companyRevision).toBe(f.revision + 2)
    expect(retried.candidates.map((candidate) => candidate.employeeId)).toEqual([
      f.people[2]!.employeeId,
    ])
  })

  test("an unavailable public reporting snapshot stops qualification without changing stored facts", async () => {
    const f = await fixture()
    expect(
      Number((await f.write([f.relation("report:unavailable", 0, 1)], "available")).status),
    ).toBe(201)
    const before = await f.persisted()
    const unavailable = spyOn(
      CompanyReportingRelationsReadAdapter.prototype,
      "readSnapshot",
    ).mockResolvedValue({ ok: false, cause: new Error("reporting storage is unavailable") })
    try {
      expect(await f.candidates("2030-06-01")).toBeInstanceOf(Error)
      expect(unavailable).toHaveBeenCalledTimes(1)
      expect(await f.persisted()).toEqual(before)
    } finally {
      unavailable.mockRestore()
    }
    const retried = await f.candidates("2030-06-01")
    if (retried instanceof Error) throw retried
    expect(retried.candidates.map((candidate) => candidate.employeeId)).toEqual([
      f.people[1]!.employeeId,
    ])
  })

  test.each(["before", "after"])(
    "the outer candidate resolver rejects changes %s canonical resolution",
    async (timing) => {
      const f = await fixture()
      const original = f.relation("report:outer-race", 0, 1)
      expect(Number((await f.write([original], "outer-initial")).status)).toBe(201)
      const resolver = new ResolveOrganizationalAuthorityCandidatesAdapter({
        c: f.context,
        subjectEmployeeId: f.people[0]!.employeeId,
        criteria: [{ kind: "direct_manager" }],
        resolvedAt: "2030-06-01T00:00:00Z",
      })
      const canonical = new ResolveCanonicalOrganizationAuthorityAdapter({
        c: f.context,
        subjectEmployeeId: f.people[0]!.employeeId,
        criteria: [{ kind: "direct_manager" }],
        employeeRows: f.people.map((person) => ({ id: person.employeeId, code: null })),
        targetDepartmentCode: null,
        asOf: "2030-06-01",
      })
      const resolve = canonical.resolveCanonicalOrganizationAuthority.bind(canonical)
      const change = async () => {
        expect(
          Number(
            (
              await f.write(
                [{ ...f.relation(original.id, 0, 2), revision: 2 }],
                "outer-change",
                f.revision + 1,
              )
            ).status,
          ),
        ).toBe(201)
      }
      const raced = spyOn(
        ResolveCanonicalOrganizationAuthorityAdapter.prototype,
        "resolveCanonicalOrganizationAuthority",
      ).mockImplementation(async () => {
        if (timing === "before") await change()
        const result = await resolve()
        if (timing === "after") await change()
        return result
      })
      try {
        expect(await resolver.resolveOrganizationalAuthorityCandidates()).toMatchObject({
          code: "organization_revision_conflict",
        })
      } finally {
        raced.mockRestore()
      }
      const retried = await resolver.resolveOrganizationalAuthorityCandidates()
      if (retried instanceof Error) throw retried
      expect(retried.candidates.map((candidate) => candidate.employeeId)).toEqual([
        f.people[2]!.employeeId,
      ])
    },
  )

  test("procedure evidence keeps the public revision and its guards reject a later manager change", async () => {
    const f = await fixture()
    const relation = f.relation("report:procedure", 0, 1)
    expect(Number((await f.write([relation], "procedure-initial")).status)).toBe(201)
    const step = zApplicationWorkflowStep.parse({
      key: "review",
      name: "Review",
      approvers: [{ type: "direct_manager" }],
    })
    const matches = await new ResolveCompanyProcedureApproverMatchesAdapter({
      c: f.context,
      applicantEmployeeId: f.people[0]!.employeeId,
      selectors: step.approvers,
      resolvedAt: "2030-06-01T00:00:00Z",
    }).resolveWorkflowApproverMatches()
    if (matches instanceof Error) throw matches
    expect(matches).toHaveLength(1)
    expect(matches[0]?.provenance.evidence).toMatchObject({
      reporting_relation_id: relation.id,
      reporting_relation_revision: 1,
      authority_snapshot: { company_revision: f.revision + 1 },
    })
    const policy = createCompanyProcedureDecisionPolicy({
      approverRoles: [],
      workflow: { version: 1, steps: [step] },
    })
    if (policy instanceof Error) throw policy
    const task = await new ResolveCompanyProcedureTaskAdapter({
      c: f.context,
      policy,
      payload: {},
      afterTaskKey: null,
      activatedAt: new Date("2030-06-01T00:00:00Z"),
      applicant: {
        employeeId: f.people[0]!.employeeId,
        employeeCode: null,
        employmentStatus: "active",
        organizationUnitId: null,
        organizationUnitCode: null,
        organizationUnitName: null,
        positionTitle: null,
      },
    }).resolveCompanyProcedureTask()
    if (task === null || task instanceof Error) throw task ?? new Error("task missing")
    expect(task.task.candidates.map((candidate) => candidate.accountId)).toEqual([
      f.people[1]!.accountId,
    ])
    expect(task.guards).toHaveLength(2)
    await f.database.batch([...task.guards])
    expect(
      Number(
        (
          await f.write(
            [{ ...f.relation(relation.id, 0, 2), revision: 2 }],
            "procedure-change",
            f.revision + 1,
          )
        ).status,
      ),
    ).toBe(201)
    const employeeId = f.people[0]!.employeeId
    const before = await f.database
      .prepare("SELECT official_name FROM company_employees WHERE id = ?")
      .bind(employeeId)
      .first<string>("official_name")
    const rejected = await f.database
      .batch([
        f.database
          .prepare("UPDATE company_employees SET official_name = 'Uncommitted Name' WHERE id = ?")
          .bind(employeeId),
        ...task.guards,
      ])
      .then(
        () => null,
        (cause: unknown) => cause,
      )
    expect(rejected).toBeInstanceOf(Error)
    expect(
      await f.database
        .prepare("SELECT official_name FROM company_employees WHERE id = ?")
        .bind(employeeId)
        .first<string>("official_name"),
    ).toBe(before)
    const current = new RevalidateCompanyProcedureAuthorityAdapter(f.context)
    expect(
      await current.revalidate({
        step,
        representedAccountId: f.people[1]!.accountId,
        subjectEmployeeId: employeeId,
        targetDepartmentCode: null,
        excludedEmployeeIds: new Set(),
        dueAt: null,
        decidedAt: new Date("2030-06-01T00:00:00Z"),
      }),
    ).toBe(false)
  })

  test("rejects a cycle hidden by another manager in every input order without saving", async () => {
    const f = await fixture()
    const ab = f.relation("report:ab", 0, 1)
    const ba = f.relation("report:ba", 1, 0)
    const ac = f.relation("report:ac", 0, 2)
    const before = await f.persisted()
    for (const resources of [
      [ab, ba, ac],
      [ab, ac, ba],
      [ba, ab, ac],
      [ba, ac, ab],
      [ac, ab, ba],
      [ac, ba, ab],
    ]) {
      const response = await f.write(resources, `cycle:${resources.map((r) => r.id).join("-")}`)
      expect(Number(response.status)).toBe(422)
      expect(z.object({ code: z.string() }).parse(await response.json()).code).toBe(
        "invalid_organization",
      )
      expect(await f.persisted()).toEqual(before)
    }
  })

  test("accepts multiple managers and a diamond, replays once, and rejects a cyclic update", async () => {
    const f = await fixture()
    const bd = f.relation("report:bd", 1, 3)
    const resources = [
      f.relation("report:ab", 0, 1),
      f.relation("report:ac", 0, 2),
      bd,
      f.relation("report:cd", 2, 3),
    ]
    expect(Number((await f.write(resources, "diamond")).status)).toBe(201)
    const before = await f.persisted()
    expect(Number((await f.write(resources, "diamond")).status)).toBe(200)
    expect(await f.persisted()).toEqual(before)
    const cycle = { ...f.relation(bd.id, 1, 0), revision: 2 }
    expect(Number((await f.write([cycle], "cyclic-update", f.revision + 1)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  test("allows touching periods but rejects a cycle that starts with a future overlap", async () => {
    const f = await fixture()
    const ab = { ...f.relation("report:ab", 0, 1), effectiveTo: "2030-02-01" }
    const ba = { ...f.relation("report:ba", 1, 0), effectiveFrom: "2030-02-01" }
    const ac = f.relation("report:ac", 0, 2)
    expect(Number((await f.write([ab, ba, ac], "touching")).status)).toBe(201)
    const before = await f.persisted()
    const overlap = { ...ba, revision: 2, effectiveFrom: "2030-01-31" }
    expect(Number((await f.write([overlap], "overlap", f.revision + 1)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  const futureStates: ReadonlyArray<Relation["state"]> = ["active", "void"]
  test.each([...futureStates])(
    "retains earlier reporting periods when a future version is %s",
    async (state) => {
      const f = await fixture()
      const ab = f.relation("report:ab", 0, 1)
      expect(Number((await f.write([ab], "initial")).status)).toBe(201)
      const future = {
        ...f.relation(ab.id, 0, 2),
        revision: 2,
        state,
        effectiveFrom: "2030-03-01",
      }
      expect(Number((await f.write([future], "future", f.revision + 1)).status)).toBe(201)
      expect(await f.readRelations("2030-01-15")).toEqual([ab])
      expect(await f.readRelations("2030-03-01")).toEqual(state === "active" ? [future] : [])
      const before = await f.persisted()
      const reverse = { ...f.relation("report:ba", 1, 0), effectiveTo: "2030-02-01" }
      const response = await f.write([reverse], "earlier-cycle", f.revision + 2)
      expect(Number(response.status)).toBe(422)
      expect(await f.persisted()).toEqual(before)
      expect(await f.readRelations("2030-01-15")).toEqual([ab])
    },
  )

  test("keeps a scheduled future manager when correcting an earlier period", async () => {
    const f = await fixture()
    const ab = f.relation("report:ab", 0, 1)
    expect(Number((await f.write([ab], "initial")).status)).toBe(201)
    const future = { ...ab, revision: 2, effectiveFrom: "2030-03-01" }
    expect(Number((await f.write([future], "future", f.revision + 1)).status)).toBe(201)
    const correction = { ...f.relation(ab.id, 0, 2), revision: 3 }
    expect(Number((await f.write([correction], "correction", f.revision + 2)).status)).toBe(201)
    const reverse = { ...f.relation("report:ba", 1, 0), effectiveTo: "2030-03-01" }
    expect(Number((await f.write([reverse], "earlier-reverse", f.revision + 3)).status)).toBe(201)
    expect(await f.readRelations("2030-02-01")).toEqual([correction, reverse])
    expect(await f.readRelations("2030-03-01")).toEqual([future])
    const before = await f.persisted()
    const laterReverse = { ...reverse, revision: 2, effectiveTo: null }
    expect(Number((await f.write([laterReverse], "later-cycle", f.revision + 4)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
  })

  test("rejects the losing concurrent write and refuses its cyclic retry", async () => {
    const f = await fixture()
    const resources = [f.relation("report:ab", 0, 1), f.relation("report:ba", 1, 0)]
    const responses = await Promise.all(
      resources.map((resource) => f.write([resource], resource.id)),
    )
    expect(
      responses.map((response) => Number(response.status)).toSorted((left, right) => left - right),
    ).toEqual([201, 409])
    const loser = resources[responses.findIndex((response) => Number(response.status) === 409)]
    if (loser === undefined) throw new Error("concurrent loser missing")
    const before = await f.persisted()
    expect(Number((await f.write([loser], "retry-cycle", f.revision + 1)).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
    expect(await f.readRelations("2030-01-15")).toHaveLength(1)
  })

  test("accepts an acyclic future even when the newest revision describes an earlier manager", async () => {
    const f = await fixture()
    const ab = f.relation("report:ab", 0, 1)
    expect(Number((await f.write([ab], "initial")).status)).toBe(201)
    const future = { ...f.relation(ab.id, 0, 2), revision: 2, effectiveFrom: "2030-03-01" }
    expect(Number((await f.write([future], "future", f.revision + 1)).status)).toBe(201)
    const correction = { ...ab, revision: 3 }
    expect(Number((await f.write([correction], "correction", f.revision + 2)).status)).toBe(201)
    const reverse = { ...f.relation("report:ba", 1, 0), effectiveFrom: "2030-03-01" }
    expect(Number((await f.write([reverse], "later-reverse", f.revision + 3)).status)).toBe(201)
    expect(await f.readRelations("2030-02-01")).toEqual([correction])
    expect(await f.readRelations("2030-03-01")).toEqual([future, reverse])
  })

  test("does not treat an unavailable history as empty and can retry without a partial write", async () => {
    const f = await fixture()
    const before = await f.persisted()
    const prepare = f.database.prepare.bind(f.database)
    const failure = spyOn(f.database, "prepare").mockImplementation((sql) => {
      if (
        sql.includes("FROM company_resource_revisions") &&
        sql.includes("organization_revision <= ?")
      )
        throw new Error("Reporting history unavailable")
      return prepare(sql)
    })
    const resource = f.relation("report:ab", 0, 1)
    try {
      expect(Number((await f.write([resource], "history-retry")).status)).toBe(503)
    } finally {
      failure.mockRestore()
    }
    expect(await f.persisted()).toEqual(before)
    expect(Number((await f.write([resource], "history-retry")).status)).toBe(201)
    expect(await f.readRelations("2030-01-15")).toEqual([resource])
  })
})
