import { expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeLifecycleReadAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle-read.adapter"
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { GET } from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"

async function createContext(legacy = false, reportingStartsOn = "2030-03-01") {
  const f = await createCompanyAssignmentResourceTestContext()
  const assignment = legacy
    ? {
        ...f.assignment,
        attributes: {
          ...f.assignment.attributes,
          organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
        },
      }
    : await f.initializeAssignment()
  if (legacy) {
    expect(
      Number(
        (
          await f.write([
            {
              organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
              type: "organization-unit",
              id: "0190005f-0000-7000-8000-0e0100000008",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: assignment.attributes.organizationUnitId,
                code: "TEAM",
                officialName: "Example Team",
                kind: "TEAM",
                parentOrganizationUnitId: f.root.id,
              },
            },
          ])
        ).status,
      ),
    ).toBe(201)
    await f.assignEmployeeCode()
    const revision = await f.database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    await f.database.batch([
      f.database
        .prepare(`INSERT INTO company_organization_change_operations
        (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
        VALUES ('1aa341cd-aeb9-472f-ac59-fedce3329f48', ?1, 1, 0, ?1 + 1, 'PENDING', 0, ?2, 'Record original assignment history')`)
        .bind(revision, f.creator.accountId),
      f.database
        .prepare(`INSERT INTO company_organization_assignment_period_versions
        (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type, position_title,
         manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
        VALUES ('0190005f-0000-7000-8000-0e0100000005', 1, ?1, ?2, ?3, 'PRIMARY', 'Coordinator', ?4,
          '2030-01-01', NULL, 0, '1aa341cd-aeb9-472f-ac59-fedce3329f48', 0)`)
        .bind(
          assignment.attributes.employmentId,
          f.people[0]!.employeeId,
          assignment.attributes.organizationUnitId,
          f.people[1]!.employeeId,
        ),
      f.database.prepare(
        "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = '1aa341cd-aeb9-472f-ac59-fedce3329f48'",
      ),
    ])
  }
  await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
  const relation = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "reporting-relation" as const,
    id: "reporting:lifecycle",
    revision: 1,
    state: "active" as const,
    effectiveFrom: reportingStartsOn,
    effectiveTo: null,
    attributes: {
      employeeId: assignment.attributes.employeeId,
      organizationUnitId: assignment.attributes.organizationUnitId,
      managerEmployeeId: f.people[1]!.employeeId,
    },
  }
  if (!legacy)
    expect(
      Number((await f.write([relation], await f.companyRevision(), "reporting:start")).status),
    ).toBe(201)
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (c, next) => {
      c.set(
        "companyActor",
        CompanyActorValue.restore({
          ...f.creator,
          organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
          capabilities: [],
          permissions: [],
        }),
      )
      c.set("database", f.context.var.database)
      c.set("auditContext", f.context.var.auditContext)
      await next()
    })
    .onError((error, c) => {
      if (error instanceof CompanyHTTPException) return c.json({ code: error.code }, error.status)
      throw error
    })
    .get("/company/employee-lifecycle/:code/state", ...GET)
  const request = (date: string) =>
    app.request(`/company/employee-lifecycle/EMPLOYEE-001/state?as_of=${date}`, {}, f.context.env)
  const assignmentSchema = z.object({
    department_code: z.string(),
    department_name: z.string(),
    manager_employee_code: z.string().nullable(),
    manager_employee_codes: z.array(z.string()),
    manager_employee_ids: z.array(z.string()),
  })
  const check = async (date: string, primaryCodes: string[], concurrentCodes: string[] = []) => {
    const response = await request(date)
    expect(response.status).toBe(200)
    const state = z
      .object({
        primary_assignment: assignmentSchema,
        concurrent_assignments: z.array(assignmentSchema),
      })
      .parse(await response.json())
    const organization = await new CurrentOrganizationReadModelAdapter({
      ...f.context,
      env: { ...f.context.env, NOW: `${date}T00:00:00Z` },
    }).loadCurrentOrganization()
    if (organization instanceof Error) throw organization
    const employee = organization.employeesByCode.get("EMPLOYEE-001")
    expect(employee).toBeDefined()
    for (const assignment of [state.primary_assignment, ...state.concurrent_assignments]) {
      const reference = employee?.assignments.find(
        (candidate) => candidate.departmentCode === assignment.department_code,
      )
      expect(reference).toBeDefined()
      expect(assignment).toMatchObject({
        department_name: organization.departments.find(
          (department) => department.code === reference?.departmentCode,
        )?.name,
        manager_employee_code: reference?.managerEmployeeCode,
        manager_employee_codes: reference?.managerEmployeeCodes,
        manager_employee_ids: reference?.managerEmployeeIds,
      })
    }
    expect(state.primary_assignment.manager_employee_codes).toEqual(primaryCodes)
    expect(state.concurrent_assignments.flatMap((row) => row.manager_employee_codes)).toEqual(
      concurrentCodes,
    )
    return state
  }
  return { ...f, assignment, relation, request, check }
}

test("人事状態は公開所属と同じ組織の公開上長を組織参照と同じコードで返す", async () => {
  const f = await createContext()
  const state = await f.check("2030-06-01", ["MANAGER-001"])
  expect(state.primary_assignment.manager_employee_code).toBe("MANAGER-001")
  // 公開所属へ上長を埋め戻さず、独立した上長関係を読む。
  expect(
    (
      await f.database
        .prepare("SELECT manager_employee_id FROM company_organization_assignment_period_versions")
        .all()
    ).results.every((row) => row.manager_employee_id === null),
  ).toBe(true)
})

test("組織番号・名称の変更と上長を同日予約しても主務・兼務の表示が組織参照と一致する", async () => {
  const f = await createContext(false, "2030-07-01")
  const primaryUnit = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "organization-unit" as const,
    id: "0190005f-0000-7000-8000-0e0100000008",
    revision: 1,
    state: "active" as const,
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: {
      organizationUnitId: f.assignment.attributes.organizationUnitId,
      code: "TEAM",
      officialName: "Example Team",
      kind: "TEAM" as const,
      parentOrganizationUnitId: f.root.id,
    },
  }
  const concurrentUnit = {
    ...primaryUnit,
    id: "0190005f-0000-7000-8000-0e0100000003",
    revision: 1,
    effectiveFrom: "2030-01-01",
    attributes: {
      ...primaryUnit.attributes,
      organizationUnitId: "0190005f-0000-7000-8000-0b68139f5ae9",
      code: "OTHER",
      officialName: "Other Team",
    },
  }
  const concurrentAssignment = {
    ...f.assignment,
    id: "0190005f-0000-7000-8000-0e0100000004",
    attributes: {
      ...f.assignment.attributes,
      organizationUnitId: concurrentUnit.attributes.organizationUnitId,
      assignmentType: "CONCURRENT" as const,
    },
  }
  expect(
    Number(
      (
        await f.write(
          [concurrentUnit, concurrentAssignment],
          await f.companyRevision(),
          "assignment:concurrent",
        )
      ).status,
    ),
  ).toBe(201)
  const changed = await f.write(
    [
      { ...primaryUnit, revision: 2, effectiveTo: "2030-07-01" },
      {
        ...primaryUnit,
        id: "0190005f-0000-7000-8000-0e010000000a",
        effectiveFrom: "2030-07-01",
        attributes: { ...primaryUnit.attributes, code: "TEAM-NEW", officialName: "Renamed Team" },
      },
      { ...concurrentUnit, revision: 2, effectiveTo: "2030-07-01" },
      {
        ...concurrentUnit,
        id: "0190005f-0000-7000-8000-0e010000000b",
        effectiveFrom: "2030-07-01",
        attributes: {
          ...concurrentUnit.attributes,
          code: "OTHER-NEW",
          officialName: "Renamed Other Team",
        },
      },
      {
        ...f.relation,
        id: "reporting:concurrent",
        attributes: {
          ...f.relation.attributes,
          organizationUnitId: concurrentUnit.attributes.organizationUnitId,
        },
      },
    ],
    await f.companyRevision(),
    "organization:future-display",
  )
  expect(Number(changed.status)).toBe(201)
  for (const date of ["2030-06-30", "2030-07-01", "2030-08-01"]) {
    const effective = date >= "2030-07-01"
    const managers = effective ? ["MANAGER-001"] : []
    const state = await f.check(date, managers, managers)
    expect(state.primary_assignment).toMatchObject({
      department_code: effective ? "TEAM-NEW" : "TEAM",
      department_name: effective ? "Renamed Team" : "Example Team",
    })
    expect(state.concurrent_assignments).toMatchObject([
      {
        department_code: effective ? "OTHER-NEW" : "OTHER",
        department_name: effective ? "Renamed Other Team" : "Other Team",
      },
    ])
  }
})

test("既存所属の上長を公開関係へ移行した後も人事状態と組織参照が一致する", async () => {
  const f = await createContext(true)
  await f.check("2030-06-01", ["MANAGER-001"])
  const preview = await f.client["assignment-adoptions"].$get({
    query: { employee_id: f.people[0]!.employeeId },
  })
  expect(Number(preview.status)).toBe(200)
  const input = z
    .object({
      expectedRevision: z.number(),
      snapshotDigest: z.string(),
      observedOn: z.string(),
    })
    .parse(await preview.json())
  expect(
    Number(
      (
        await f.client["assignment-adoptions"].$post({
          header: { "idempotency-key": "assignment:adopt" },
          json: {
            ...input,
            employeeId: f.people[0]!.employeeId,
            reason: "Confirm original history",
          },
        })
      ).status,
    ),
  ).toBe(201)
  expect(await f.publicAssignments("2030-06-01")).toHaveLength(1)
  expect(await f.publicReporting("2030-06-01")).toHaveLength(1)
  await f.check("2030-06-01", ["MANAGER-001"])
})

test("上長の登録・変更・終了と主務・兼務を同じ基準日で解決する", async () => {
  const f = await createContext()
  await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
  const changed = {
    ...f.relation,
    revision: 2,
    effectiveFrom: "2030-07-01",
    attributes: { ...f.relation.attributes, managerEmployeeId: f.people[2]!.employeeId },
  }
  const unitId = "0190005f-0000-7000-8000-0b68139f5ae9"
  const concurrent = {
    ...f.assignment,
    id: "0190005f-0000-7000-8000-0e0100000004",
    attributes: {
      ...f.assignment.attributes,
      organizationUnitId: unitId,
      assignmentType: "CONCURRENT" as const,
    },
  }
  expect(
    Number(
      (
        await f.write(
          [
            {
              organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
              type: "organization-unit",
              id: "0190005f-0000-7000-8000-0e0100000003",
              revision: 1,
              state: "active",
              effectiveFrom: "2030-01-01",
              effectiveTo: null,
              attributes: {
                organizationUnitId: unitId,
                code: "OTHER",
                officialName: "Other team",
                kind: "TEAM",
                parentOrganizationUnitId: f.root.id,
              },
            },
            concurrent,
            {
              ...f.relation,
              id: "reporting:concurrent",
              effectiveTo: "2030-09-01",
              attributes: { ...f.relation.attributes, organizationUnitId: unitId },
            },
            changed,
          ],
          await f.companyRevision(),
          "reporting:change",
        )
      ).status,
    ),
  ).toBe(201)
  expect(
    Number(
      (
        await f.write(
          [{ ...changed, revision: 3, state: "void", effectiveFrom: "2030-09-01" }],
          await f.companyRevision(),
          "reporting:end",
        )
      ).status,
    ),
  ).toBe(201)
  for (const [date, primary, concurrent] of [
    ["2030-02-28", [], []],
    ["2030-03-01", ["MANAGER-001"], ["MANAGER-001"]],
    ["2030-06-30", ["MANAGER-001"], ["MANAGER-001"]],
    ["2030-07-01", ["MANAGER-002"], ["MANAGER-001"]],
    ["2030-08-31", ["MANAGER-002"], ["MANAGER-001"]],
    ["2030-09-01", [], []],
  ] satisfies Array<[string, string[], string[]]>)
    await f.check(date, primary, concurrent)
})

test("複数上長は重複のない集合を返し、コード未設定の上長がいても一人を選ばない", async () => {
  const f = await createContext()
  await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
  expect(
    Number(
      (
        await f.write(
          [
            { ...f.relation, id: "reporting:duplicate" },
            {
              ...f.relation,
              id: "reporting:second",
              effectiveFrom: "2030-05-01",
              effectiveTo: "2030-07-01",
              attributes: { ...f.relation.attributes, managerEmployeeId: f.people[2]!.employeeId },
            },
            {
              ...f.relation,
              id: "reporting:uncoded",
              effectiveFrom: "2030-07-01",
              attributes: { ...f.relation.attributes, managerEmployeeId: f.people[3]!.employeeId },
            },
          ],
          await f.companyRevision(),
          "reporting:many",
        )
      ).status,
    ),
  ).toBe(201)
  expect(
    (await f.check("2030-04-01", ["MANAGER-001"])).primary_assignment.manager_employee_code,
  ).toBe("MANAGER-001")
  const many = await f.check("2030-05-01", ["MANAGER-001", "MANAGER-002"])
  expect(many.primary_assignment.manager_employee_code).toBeNull()
  expect(many.primary_assignment.manager_employee_ids).toEqual(
    [f.people[1]!.employeeId, f.people[2]!.employeeId].sort(),
  )
  const uncoded = await f.check("2030-07-01", ["MANAGER-001"])
  expect(uncoded.primary_assignment.manager_employee_code).toBeNull()
  expect(uncoded.primary_assignment.manager_employee_ids).toHaveLength(2)
})

test("上長の従業員コードも関係と同じ基準日の公開値で返す", async () => {
  const f = await createContext()
  const snapshot = await new D1CompanyResourceRepository({ database: f.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
    ids: [f.people[1]!.employeeId],
  })
  if (!snapshot.ok) throw snapshot.cause
  const employee = snapshot.resources[0]
  const personId = employee?.readText("personId")
  if (employee === undefined || personId === undefined || personId === null)
    throw new Error("manager missing")
  expect(
    Number(
      (
        await f.client.employees.$post({
          header: {
            "idempotency-key": "manager:future-code",
            "if-match": String(await f.companyRevision()),
            "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
          },
          json: {
            reason: "Reserve manager code",
            resources: [
              {
                organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                type: "employee",
                id: employee.id,
                revision: employee.revision + 1,
                state: "active",
                effectiveFrom: "2030-07-01",
                effectiveTo: null,
                attributes: { personId, employeeCode: "MANAGER-FUTURE" },
              },
            ],
          },
        })
      ).status,
    ),
  ).toBe(201)
  await f.check("2030-06-30", ["MANAGER-001"])
  await f.check("2030-07-01", ["MANAGER-FUTURE"])
})

test.each(["reporting", "projection", "organization", "directory"])(
  "人事状態の取得中に会社版が変わったら混在した上長を返さない: %s",
  async (stage) => {
    const f = await createContext()
    const update = async () =>
      expect(
        Number(
          (
            await f.write(
              stage === "organization"
                ? [
                    {
                      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
                      type: "organization-unit",
                      id: "0190005f-0000-7000-8000-0e0100000008",
                      revision: 2,
                      state: "active",
                      effectiveFrom: "2030-01-01",
                      effectiveTo: null,
                      attributes: {
                        organizationUnitId: f.assignment.attributes.organizationUnitId,
                        code: "TEAM",
                        officialName: "Updated Team",
                        kind: "TEAM",
                        parentOrganizationUnitId: f.root.id,
                      },
                    },
                  ]
                : [{ ...f.relation, revision: 2, effectiveTo: "2030-05-01" }],
              await f.companyRevision(),
              `reporting:race:${stage}`,
            )
          ).status,
        ),
      ).toBe(201)
    const reportingRead = CompanyReportingRelationsReadAdapter.prototype.readSnapshot
    const projectionRead = EmployeeLifecycleReadAdapter.prototype.findStatesAt
    const directoryRead = CompanyEmployeeDirectoryReadAdapter.prototype.findForEmployeeIds
    const intercepted =
      stage === "reporting"
        ? spyOn(
            CompanyReportingRelationsReadAdapter.prototype,
            "readSnapshot",
          ).mockImplementationOnce(async function (
            this: CompanyReportingRelationsReadAdapter,
            ...args
          ) {
            const value = await reportingRead.apply(this, args)
            await update()
            return value
          })
        : stage === "projection" || stage === "organization"
          ? spyOn(EmployeeLifecycleReadAdapter.prototype, "findStatesAt").mockImplementationOnce(
              async function (this: EmployeeLifecycleReadAdapter, ...args) {
                const value = await projectionRead.apply(this, args)
                await update()
                return value
              },
            )
          : spyOn(
              CompanyEmployeeDirectoryReadAdapter.prototype,
              "findForEmployeeIds",
            ).mockImplementationOnce(async function (
              this: CompanyEmployeeDirectoryReadAdapter,
              ...args
            ) {
              const value = await directoryRead.apply(this, args)
              await update()
              return value
            })
    try {
      const response = await f.request("2030-06-01")
      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: "organization_revision_conflict" })
    } finally {
      intercepted.mockRestore()
    }
    await f.check("2030-06-01", stage === "organization" ? ["MANAGER-001"] : [])
  },
)

test("公開上長の合成前に所属の投影と共通状態の不一致を拒否する", async () => {
  const f = await createContext()
  const read = EmployeeLifecycleReadAdapter.prototype.findStatesAt
  const intercepted = spyOn(
    EmployeeLifecycleReadAdapter.prototype,
    "findStatesAt",
  ).mockImplementationOnce(async function (this: EmployeeLifecycleReadAdapter, ...args) {
    const states = await read.apply(this, args)
    if (states instanceof Error) return states
    const state = states.get(f.people[0]!.employeeId)
    if (state === undefined || state.primaryAssignment === null)
      throw new Error("assignment missing")
    return new Map(states).set(state.employeeId, {
      ...state,
      primaryAssignment: {
        ...state.primaryAssignment,
        managerEmployeeId: f.people[1]!.employeeId,
      },
    })
  })
  try {
    const response = await f.request("2030-06-01")
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: "lifecycle_projection_mismatch" })
  } finally {
    intercepted.mockRestore()
  }
})

test("公開上長関係を取得できない場合は上長なしと答えない", async () => {
  const f = await createContext()
  const intercepted = spyOn(
    CompanyReportingRelationsReadAdapter.prototype,
    "readSnapshot",
  ).mockResolvedValue({ ok: false, cause: new Error("reporting unavailable") })
  try {
    const response = await f.request("2030-06-01")
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: "organization_snapshot_unavailable" })
  } finally {
    intercepted.mockRestore()
  }
})
