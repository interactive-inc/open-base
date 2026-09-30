import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { GET as GET_0 } from "@/contexts/company/interface/routes/company.people"
import { GET as GET_1 } from "@/contexts/company/interface/routes/company.employees"
import { GET as GET_2 } from "@/contexts/company/interface/routes/company.employments"
import { GET as GET_3 } from "@/contexts/company/interface/routes/company.profile"
import { GET as GET_4 } from "@/contexts/company/interface/routes/company.account-employee-links"
import { GET as GET_5 } from "@/contexts/company/interface/routes/company.legacy-personnel-action-records"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("会社の各台帳は同じ会社版で取得でき、遡及更新後も旧版の内容と有効期間を保つ", async () => {
  const database = await createLocalD1Database({
    schema:
      readFileSync(
        new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
        "utf8",
      ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  })
  await execSql(
    database,
    "INSERT INTO system_accounts (id, status, created_at, updated_at) VALUES ('f1c2f755-e201-42b2-a586-2d79c0d8bbca', 'active', 0, 0)",
  )
  const repository = new D1CompanyResourceRepository({ database })
  const specifications: Pick<CompanyResourceProps, "type" | "id" | "attributes">[] = [
    { type: "person", id: "person:test", attributes: { officialName: "Person" } },
    {
      type: "employee",
      id: "d47aa389-c802-4a4a-bf7c-c359b764474b",
      attributes: { personId: "person:test", employeeCode: "E001" },
    },
    {
      type: "employment",
      id: "cdc317d0-f2a5-47e3-bbaa-4718f418c374",
      attributes: {
        employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        status: "ACTIVE",
        employmentType: "FULL_TIME",
      },
    },
    {
      type: "company-profile",
      id: "profile:test",
      attributes: {
        displayName: "Company",
        locale: "en",
        timeZone: "UTC",
        fiscalYearStartMonth: 1,
      },
    },
    {
      type: "account-employee-link",
      id: "2a3b4c5d-6e7f-4a8b-9c0d-1e2f3a4b5c6d",
      attributes: {
        employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        accountId: "f1c2f755-e201-42b2-a586-2d79c0d8bbca",
      },
    },
    { type: "personnel-action", id: "action:test", attributes: { actionType: "HIRE" } },
  ]
  for (const revision of [1, 2]) {
    const command = CompanyResourceChangeEntity.create({
      commandId: `resource-snapshot:${revision}`,
      expectedRevision: revision - 1,
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      reason: "Confirmed record correction",
      recordedAt: revision,
      resources: specifications.map((specification) => ({
        ...specification,
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        revision,
        state: "active",
        effectiveFrom: restoreCalendarDate("2030-01-01"),
        effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-07-01"),
      })),
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  }
  const state = { authorized: true, employeeRead: true }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set("companyClock", () => new Date("2030-06-01T00:00:00Z"))
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
        employeeId: null,
        organizationIds: [
          state.authorized
            ? COMPANY_DEFAULT_ORGANIZATION_ID
            : "01900060-0000-7000-8000-12268fccf2cc",
        ],
        capabilities: ["company:read"],
        permissions: state.employeeRead
          ? ["employee:read", "employee:attributes:read"]
          : ["org:read"],
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/people", ...GET_0)
  app.get("/employees", ...GET_1)
  app.get("/employments", ...GET_2)
  app.get("/profile", ...GET_3)
  app.get("/account-employee-links", ...GET_4)
  app.get("/legacy-personnel-action-records", ...GET_5)
  for (const path of [
    "people",
    "employees",
    "employments",
    "profile",
    "account-employee-links",
    "legacy-personnel-action-records",
  ]) {
    const headers = { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID }
    for (const revision of [1, 2]) {
      const response = await app.request(
        `/${path}?organization_revision=${revision}&effective_on=2030-06-01`,
        { headers },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(200)
      expect(response.headers.get("etag")).toBe(`"${revision}"`)
      expect(await response.json()).toMatchObject({
        organizationRevision: revision,
        resources: [{ revision }],
      })
    }
    for (const revision of [0, 1, 2]) {
      const response = await app.request(
        `/${path}?organization_revision=${revision}&effective_on=2030-08-01`,
        { headers },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        organizationRevision: revision,
        resources: revision === 1 ? [{ revision: 1 }] : [],
      })
    }
    for (const revision of ["3", "-1", "1.5", "9007199254740992", "invalid"]) {
      const response = await app.request(
        `/${path}?organization_revision=${revision}`,
        { headers },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(400)
    }
    state.authorized = false
    const forbidden = await app.request(
      `/${path}?organization_revision=3`,
      { headers },
      { DB: database, COMPANY_TIME_ZONE: "UTC" },
    )
    expect(forbidden.status).toBe(403)
    state.authorized = true
  }

  const headers = { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID }
  state.employeeRead = false
  for (const path of [
    "people",
    "employees",
    "employments",
    "account-employee-links",
    "legacy-personnel-action-records",
  ]) {
    expect(
      (await app.request(`/${path}`, { headers }, { DB: database, COMPANY_TIME_ZONE: "UTC" }))
        .status,
    ).toBe(403)
  }
  expect(
    (await app.request("/profile", { headers }, { DB: database, COMPANY_TIME_ZONE: "UTC" })).status,
  ).toBe(200)
  state.employeeRead = true
  const endedEmployment = await app.request(
    "/employments?organization_revision=2&effective_on=2030-08-01&include_ended=true",
    { headers },
    { DB: database, COMPANY_TIME_ZONE: "UTC" },
  )
  expect(endedEmployment.status).toBe(200)
  expect(await endedEmployment.json()).toMatchObject({
    organizationRevision: 2,
    resources: [
      { id: "cdc317d0-f2a5-47e3-bbaa-4718f418c374", revision: 2, effectiveTo: "2030-07-01" },
    ],
  })
  const employeeEmployment = await app.request(
    "/employments?organization_revision=2&effective_on=2030-08-01&include_ended=true&employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b",
    { headers },
    { DB: database, COMPANY_TIME_ZONE: "UTC" },
  )
  expect(employeeEmployment.status).toBe(200)
  expect(await employeeEmployment.json()).toMatchObject({
    organizationRevision: 2,
    resources: [{ id: "cdc317d0-f2a5-47e3-bbaa-4718f418c374" }],
  })
  const unrelatedEmployee = await app.request(
    "/employments?organization_revision=2&effective_on=2030-08-01&include_ended=true&employee_id=employee:other",
    { headers },
    { DB: database, COMPANY_TIME_ZONE: "UTC" },
  )
  expect(unrelatedEmployee.status).toBe(200)
  expect(await unrelatedEmployee.json()).toMatchObject({
    organizationRevision: 2,
    resources: [],
  })
  const duplicateEmployee = await app.request(
    "/employments?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b",
    { headers },
    { DB: database, COMPANY_TIME_ZONE: "UTC" },
  )
  expect(duplicateEmployee.status).toBe(400)
  const missingDate = await app.request(
    "/employments?include_ended=true",
    { headers },
    { DB: database, COMPANY_TIME_ZONE: "UTC" },
  )
  expect(missingDate.status).toBe(400)
})
