import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { GET } from "@/contexts/company/interface/routes/company.organization-snapshots"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { createCompanyGradeAssignmentTestContext } from "@/contexts/company/test/company-grade-assignment.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("公開組織snapshotは指定会社版と有効日を維持し、未来版・不正値・権限不足を拒否する", async () => {
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
  for (const revision of [1, 2]) {
    const command = CompanyResourceChangeEntity.create({
      commandId: `snapshot:${revision}`,
      expectedRevision: revision - 1,
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      reason: "Confirmed organization",
      recordedAt: revision,
      resources: [
        {
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          type: "organization-unit",
          id: "0190005f-0000-7000-8000-0e0100000001",
          revision,
          state: "active",
          effectiveFrom: restoreCalendarDate("2030-01-01"),
          effectiveTo: null,
          attributes: {
            organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
            code: "ROOT",
            officialName: `Name ${revision}`,
            kind: "COMPANY",
            parentOrganizationUnitId: null,
          },
        },
      ],
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  }
  const state = { authorized: true }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
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
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  const routes = app.get("/snapshots", ...GET)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, { DB: database }),
      { preconnect: fetch.preconnect },
    ),
  })
  for (const version of ["1", "2"]) {
    const response = await client.snapshots.$get({
      header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
      query: { organization_revision: version, effective_on: "2030-06-01" },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("etag")).toBe(`"${version}"`)
    expect(await response.json()).toMatchObject({
      organizationRevision: Number(version),
      resources: [{ revision: Number(version), attributes: { officialName: `Name ${version}` } }],
    })
  }
  for (const version of ["3", "-1", "1.5", "9007199254740992", "invalid"]) {
    const response = await client.snapshots.$get({
      header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
      query: { organization_revision: version },
    })
    expect(Number(response.status)).toBe(400)
  }
  state.authorized = false
  const forbidden = await client.snapshots.$get({
    header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
    query: { organization_revision: "1" },
  })
  expect(Number(forbidden.status)).toBe(403)
})

test("組織閲覧だけのsnapshotは従業員の等級割当を含まない", async () => {
  const f = await createCompanyGradeAssignmentTestContext()
  const access = { attributesRead: false }
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set(
        "companyActor",
        CompanyActorValue.restore({
          accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
          employeeId: null,
          organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
          capabilities: ["company:read"],
          permissions: access.attributesRead
            ? ["org:read", "employee:attributes:read"]
            : ["org:read"],
        }),
      )
      await next()
    })
    .get("/snapshots", ...GET)
  const request = async () =>
    app.request(
      "/snapshots?effective_on=2030-04-01",
      { headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID } },
      { DB: f.database },
    )
  const orgOnly = await request()
  expect(orgOnly.status).toBe(200)
  const responseSchema = z.object({ resources: z.array(z.object({ type: z.string() })) })
  const orgResources = responseSchema.parse(await orgOnly.json()).resources
  expect(orgResources.some((resource) => resource.type === "assignment")).toBe(true)
  expect(orgResources.some((resource) => resource.type === "grade-assignment")).toBe(false)

  access.attributesRead = true
  const authorized = await request()
  expect(authorized.status).toBe(200)
  const authorizedResources = responseSchema.parse(await authorized.json()).resources
  expect(authorizedResources.some((resource) => resource.type === "grade-assignment")).toBe(true)
})
