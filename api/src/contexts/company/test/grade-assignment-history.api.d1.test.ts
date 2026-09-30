import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { GET } from "@/contexts/company/interface/routes/company.grade-assignment-history"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("本人の等級履歴は訂正・取消・根拠を保持し、ページ間の更新で指定版が変わらない", async () => {
  const database = await createLocalD1Database({
    schema:
      readFileSync(
        new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
        "utf8",
      ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  })
  const repository = new D1CompanyResourceRepository({ database })
  const specifications: Pick<CompanyResourceProps, "type" | "id" | "attributes">[] = [
    { type: "person", id: "person:test", attributes: { officialName: "Person" } },
    {
      type: "employee",
      id: "d47aa389-c802-4a4a-bf7c-c359b764474b",
      attributes: { personId: "person:test" },
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
    { type: "grade", id: "grade:test", attributes: { code: "G1", officialName: "Grade" } },
    {
      type: "grade-assignment",
      id: "grade-assignment:first",
      attributes: {
        employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        employmentId: "cdc317d0-f2a5-47e3-bbaa-4718f418c374",
        gradeId: "grade:test",
      },
    },
    {
      type: "grade-assignment",
      id: "grade-assignment:second",
      attributes: {
        employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        employmentId: "cdc317d0-f2a5-47e3-bbaa-4718f418c374",
        gradeId: "grade:test",
      },
    },
  ]
  const state: { actor: CompanyActorValue | undefined } = {
    actor: CompanyActorValue.restore({
      accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
      employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: [],
    }),
  }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (state.actor !== undefined) context.set("companyActor", state.actor)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/history", ...GET)
  const headers = { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID }
  for (const revision of [1, 2, 3]) {
    const command = CompanyResourceChangeEntity.create({
      commandId: `history:${revision}`,
      expectedRevision: revision - 1,
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      reason: `Confirmed reason ${revision}`,
      recordedAt: revision,
      resources: specifications
        .filter((specification) => revision === 1 || specification.type === "grade-assignment")
        .map((specification) => ({
          ...specification,
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          revision,
          state: revision === 3 ? "void" : "active",
          effectiveFrom: restoreCalendarDate(
            specification.id.endsWith(":second") ? "2030-07-01" : "2030-01-01",
          ),
          effectiveTo: specification.id.endsWith(":first")
            ? restoreCalendarDate("2030-07-01")
            : null,
        })),
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
    if (revision === 2) {
      const first = await app.request(
        "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=2&limit=1",
        { headers },
        { DB: database },
      )
      expect(first.status).toBe(200)
      expect(await first.json()).toMatchObject({
        organizationRevision: 2,
        nextOffset: 1,
        revisions: [
          {
            id: "grade-assignment:first",
            revision: 1,
            commandId: "history:1",
            actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
            reason: "Confirmed reason 1",
            recordedAt: 1,
          },
        ],
      })
    }
  }
  const remaining = await app.request(
    "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=2&offset=1",
    { headers },
    { DB: database },
  )
  expect(remaining.status).toBe(200)
  expect(remaining.headers.get("etag")).toBe('"2"')
  expect(await remaining.json()).toMatchObject({
    organizationRevision: 2,
    nextOffset: null,
    revisions: [
      { id: "grade-assignment:second", revision: 1 },
      { id: "grade-assignment:first", revision: 2 },
      { id: "grade-assignment:second", revision: 2 },
    ],
  })
  const cancelled = await app.request(
    "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=3&offset=4",
    { headers },
    { DB: database },
  )
  expect(await cancelled.json()).toMatchObject({
    revisions: [
      { state: "void", revision: 3 },
      { state: "void", revision: 3 },
    ],
  })
  for (const query of [
    "organization_revision=4",
    "organization_revision=-1",
    "organization_revision=1.5",
    "organization_revision=9007199254740992",
    "organization_revision=2&limit=101",
    "organization_revision=2&offset=-1",
    "",
  ]) {
    const invalid = await app.request(
      `/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&${query}`,
      { headers },
      { DB: database },
    )
    expect(invalid.status).toBe(400)
  }
  const other = await app.request(
    "/history?employee_id=employee:other&organization_revision=2",
    { headers },
    { DB: database },
  )
  expect(other.status).toBe(403)
  state.actor = CompanyActorValue.restore({
    accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: [],
    permissions: ["employee:attributes:read"],
  })
  expect(
    (
      await app.request(
        "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=2",
        { headers },
        { DB: database },
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await app.request(
        "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=2",
        { headers: { "x-company-organization-id": "01900060-0000-7000-8000-12268fccf2cc" } },
        { DB: database },
      )
    ).status,
  ).toBe(403)
  state.actor = undefined
  expect(
    (
      await app.request(
        "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=2",
        { headers },
        { DB: database },
      )
    ).status,
  ).toBe(401)
  state.actor = CompanyActorValue.restore({
    accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
    employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: [],
  })
  database.prepare = () => {
    throw new Error("storage unavailable")
  }
  expect(
    (
      await app.request(
        "/history?employee_id=d47aa389-c802-4a4a-bf7c-c359b764474b&organization_revision=2",
        { headers },
        { DB: database },
      )
    ).status,
  ).toBe(503)
})
