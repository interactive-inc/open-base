import { EmployeeLifecycleReadAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle-read.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { GET as events } from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.events"
import { Hono } from "hono"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { GET as state } from "@/contexts/company/interface/routes/company.employee-lifecycle.$code.state"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("将来コード・遡及訂正・予約の訂正で人事状態の対象と応答コードを同じ有効日に揃える", async () => {
  const f = await createGovernanceTaskTestContext()
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const head = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
    ids: [f.creator.employeeId],
  })
  if (!head.ok || head.resources[0] === undefined) throw new Error("missing employee")
  const employee = head.resources[0].toProps()
  const today = restoreCalendarDate(f.at.toISOString().slice(0, 10))
  await f.write([
    {
      ...employee,
      revision: employee.revision + 1,
      attributes: { ...employee.attributes, employeeCode: "BEFORE-CODE" },
    },
  ])
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (c, next) => {
      c.set(
        "companyActor",
        CompanyActorValue.restore({
          accountId: f.creator.accountId,
          employeeId: f.creator.employeeId,
          organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
          capabilities: [],
          permissions: ["employee:read"],
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
    .get("/company/employee-lifecycle/:code/state", ...state)
    .get("/company/employee-lifecycle/:code/events", ...events)
  const readState = (code: string) =>
    app.request(`/company/employee-lifecycle/${code}/state?as_of=${today}`, {}, f.context.env)
  const beforeResponse = await readState("BEFORE-CODE")
  const before = await new EmployeeRepository(f.context).find({ code: "BEFORE-CODE" })
  if (before === null || before instanceof Error) throw new Error("initial code lookup failed")
  const future = new Date(f.at.getTime() + 366 * 86400000).toISOString().slice(0, 10)
  await f.write([
    {
      ...employee,
      revision: employee.revision + 2,
      effectiveFrom: restoreCalendarDate(future),
      attributes: { ...employee.attributes, employeeCode: "FUTURE-CODE" },
    },
  ])
  const publicCurrent = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employee"],
    ids: [f.creator.employeeId],
    effectiveOn: today,
  })
  if (!publicCurrent.ok) throw new Error("public snapshot failed")
  const oldLookup = await new EmployeeRepository(f.context).find({ code: "BEFORE-CODE" })
  const futureLookup = await new EmployeeRepository(f.context).find({ code: "FUTURE-CODE" })
  const afterResponse = await readState("BEFORE-CODE")
  const futureResponse = await readState("FUTURE-CODE")
  expect(beforeResponse.status).toBe(200)
  expect(afterResponse.status).toBe(200)
  expect(await afterResponse.json()).toMatchObject({ employee_code: "BEFORE-CODE", as_of: today })
  expect(futureResponse.status).toBe(404)
  const scheduled = await app.request(
    `/company/employee-lifecycle/FUTURE-CODE/state?as_of=${future}`,
    {},
    f.context.env,
  )
  expect(scheduled.status).toBe(200)
  expect(await scheduled.json()).toMatchObject({ employee_code: "FUTURE-CODE", as_of: future })
  expect(
    (
      await app.request(
        `/company/employee-lifecycle/BEFORE-CODE/state?as_of=${future}`,
        {},
        f.context.env,
      )
    ).status,
  ).toBe(404)
  expect(
    (await app.request("/company/employee-lifecycle/BEFORE-CODE/events", {}, f.context.env)).status,
  ).toBe(200)
  expect(
    (await app.request("/company/employee-lifecycle/FUTURE-CODE/events", {}, f.context.env)).status,
  ).toBe(404)
  expect(publicCurrent.resources.map((r) => r.readText("employeeCode"))).toEqual(["BEFORE-CODE"])
  expect(oldLookup).not.toBeNull()
  expect(oldLookup).not.toBeInstanceOf(Error)
  expect(futureLookup).toBeNull()
  await f.write([
    {
      ...employee,
      revision: employee.revision + 3,
      attributes: { ...employee.attributes, employeeCode: "CORRECTED-CODE" },
    },
  ])
  expect((await readState("BEFORE-CODE")).status).toBe(404)
  const corrected = await readState("CORRECTED-CODE")
  expect(corrected.status).toBe(200)
  expect(await corrected.json()).toMatchObject({ employee_code: "CORRECTED-CODE", as_of: today })
  expect(
    (
      await app.request(
        `/company/employee-lifecycle/FUTURE-CODE/state?as_of=${future}`,
        {},
        f.context.env,
      )
    ).status,
  ).toBe(200)
  await f.write([
    {
      ...employee,
      revision: employee.revision + 4,
      effectiveFrom: restoreCalendarDate(future),
      attributes: { ...employee.attributes, employeeCode: "CORRECTED-CODE" },
    },
  ])
  expect((await readState("CORRECTED-CODE")).status).toBe(200)
  expect(
    (
      await app.request(
        `/company/employee-lifecycle/FUTURE-CODE/state?as_of=${future}`,
        {},
        f.context.env,
      )
    ).status,
  ).toBe(404)
  expect(
    (
      await app.request(
        `/company/employee-lifecycle/CORRECTED-CODE/state?as_of=${future}`,
        {},
        f.context.env,
      )
    ).status,
  ).toBe(200)
})

test("基準日を追加しても100件の従業員IDがD1のbind上限を超えない", async () => {
  const f = await createGovernanceTaskTestContext()
  const ids = [
    f.creator.employeeId,
    ...Array.from({ length: 99 }, (_, index) =>
      restoreWorkforceId("employee", `employee:missing:${index}`),
    ),
  ]
  const prepare = f.database.prepare.bind(f.database)
  const sizes: number[] = []
  const guard = spyOn(f.database, "prepare").mockImplementation((query) => {
    const statement = prepare(query)
    const bind = statement.bind.bind(statement)
    statement.bind = (...values) => {
      sizes.push(values.length)
      if (values.length > 100) throw new Error("D1 bound parameter limit exceeded")
      return bind(...values)
    }
    return statement
  })
  try {
    const states = await new EmployeeLifecycleReadAdapter(f.context).findStatesAt(
      ids,
      f.at.toISOString().slice(0, 10),
    )
    expect(states).not.toBeInstanceOf(Error)
    if (states instanceof Error) throw states
    expect([...states.keys()]).toEqual([f.creator.employeeId])
    expect(Math.max(...sizes)).toBeLessThanOrEqual(100)
  } finally {
    guard.mockRestore()
  }
})
