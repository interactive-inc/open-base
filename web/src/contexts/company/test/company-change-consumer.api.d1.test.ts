import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { GET as changes } from "@/contexts/company/interface/routes/company.changes"
import { GET as people } from "@/contexts/company/interface/routes/company.people"
import { GET as employees } from "@/contexts/company/interface/routes/company.employees"
import { GET as employments } from "@/contexts/company/interface/routes/company.employments"
import { GET as profile } from "@/contexts/company/interface/routes/company.profile"
import { GET as organizationSnapshots } from "@/contexts/company/interface/routes/company.organization-snapshots"
import { GET as definitions } from "@/contexts/company/interface/routes/company.definitions"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const resourceSchema = z.object({
  id: z.string(),
  type: z.string(),
  revision: z.number(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
})
const snapshotSchema = z.object({
  organizationRevision: z.number(),
  resources: z.array(resourceSchema),
})
const pageSchema = z.object({
  data: z.array(z.object({ resource_type: z.string(), resource_id: z.string() })),
  through_revision: z.number(),
  next_cursor: z.string(),
  has_more: z.boolean(),
})
const consumerSchema = z.object({
  cursor: z.string().nullable(),
  throughRevision: z.number().nullable(),
  publishedRevision: z.number(),
  published: z.record(z.string(), resourceSchema),
  staged: z.record(z.string(), resourceSchema),
})
const paths = new Map([
  ["person", "people"],
  ["employee", "employees"],
  ["employment", "employments"],
  ["company-profile", "profile"],
  ["organization-unit", "organization-snapshots"],
  ["assignment", "organization-snapshots"],
  ["responsibility-assignment", "organization-snapshots"],
  ["responsibility", "definitions"],
  ["authority-scope", "definitions"],
])

function consumer() {
  return consumerSchema.parse({
    cursor: null,
    throughRevision: null,
    publishedRevision: 0,
    published: {},
    staged: {},
  })
}

async function fixture() {
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
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
        employeeId: null,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        capabilities: ["company:read"],
        permissions: ["employee:read", "employee:attributes:read"],
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/changes", ...changes)
  app.get("/people", ...people)
  app.get("/employees", ...employees)
  app.get("/employments", ...employments)
  app.get("/profile", ...profile)
  app.get("/organization-snapshots", ...organizationSnapshots)
  app.get("/definitions", ...definitions)
  return {
    async write(revision: number, resources: CompanyResourceProps[]) {
      const command = CompanyResourceChangeEntity.create({
        commandId: `consumer:${revision}`,
        expectedRevision: revision - 1,
        actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
        reason: "Confirmed correction",
        recordedAt: revision,
        resources,
      })
      if (command instanceof Error) throw command
      expect(await repository.write(command)).toMatchObject({ kind: "applied" })
    },
    async request(this: void, path: string) {
      const response = await app.request(
        path,
        {
          headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
        },
        { DB: database, COMPANY_TIME_ZONE: "UTC" },
      )
      expect(response.status).toBe(200)
      return response.json()
    },
  }
}

function resources(revision: number): CompanyResourceProps[] {
  const base = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    revision,
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  }
  return [
    {
      ...base,
      state: "active",
      type: "person",
      id: "person:test",
      attributes: { officialName: revision === 1 ? "Original name" : "Corrected name" },
    },
    {
      ...base,
      state: "active",
      type: "employee",
      id: "d47aa389-c802-4a4a-bf7c-c359b764474b",
      attributes: { personId: "person:test", employeeCode: "E001" },
    },
    {
      ...base,
      state: "active",
      type: "employment",
      id: "cdc317d0-f2a5-47e3-bbaa-4718f418c374",
      effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-10-01"),
      attributes: {
        employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        status: "ACTIVE",
        employmentType: "FULL_TIME",
      },
    },
    {
      ...base,
      state: "active",
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
      ...base,
      state: "active",
      type: "organization-unit",
      id: "0190005f-0000-7000-8000-0e0100000001",
      attributes: {
        organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
        code: "ROOT",
        officialName: "Root",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      },
    },
    {
      ...base,
      state: "active",
      type: "assignment",
      id: "9b4f2d0a-5e6c-4b8d-9f0a-1b2c3d4e5f60",
      effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-10-01"),
      attributes: {
        employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        employmentId: "cdc317d0-f2a5-47e3-bbaa-4718f418c374",
        organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
        assignmentType: "PRIMARY",
        positionTitle: revision === 1 ? "Member" : "Coordinator",
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility",
      id: "responsibility:approve",
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
    {
      ...base,
      state: "active",
      type: "authority-scope",
      id: "scope:amount",
      attributes: {
        scopeType: "amount",
        currencyCode: "JPY",
        minimumAmount: 100,
        maximumAmount: 1000,
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility-assignment",
      id: "0c5a3e1b-6f7d-4c9e-8a1b-2c3d4e5f6071",
      effectiveTo: revision === 1 ? null : restoreCalendarDate("2030-10-01"),
      attributes: {
        responsibilityId: "responsibility:approve",
        holderType: "employee",
        holderId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
        authorityScopeId: "scope:amount",
        delegationAllowed: revision === 1,
      },
    },
  ]
}

async function advance(props: {
  request: Awaited<ReturnType<typeof fixture>>["request"]
  consumer: z.infer<typeof consumerSchema>
  limit: number
  effectiveOn: string
}) {
  const state = props.consumer
  const query = new URLSearchParams({ limit: String(props.limit) })
  if (state.cursor !== null) query.set("cursor", state.cursor)
  if (state.throughRevision !== null) query.set("through_revision", String(state.throughRevision))
  const page = pageSchema.parse(await props.request(`/changes?${query.toString()}`))
  state.throughRevision = page.through_revision
  for (const change of page.data) {
    const path = paths.get(change.resource_type)
    if (path === undefined) throw new Error("Unmapped Company resource")
    const snapshot = snapshotSchema.parse(
      await props.request(
        `/${path}?${new URLSearchParams({
          id: change.resource_id,
          organization_revision: String(page.through_revision),
          effective_on: props.effectiveOn,
        }).toString()}`,
      ),
    )
    expect(snapshot.organizationRevision).toBe(page.through_revision)
    const key = `${change.resource_type}:${change.resource_id}`
    delete state.staged[key]
    for (const resource of snapshot.resources) {
      if (resource.type === change.resource_type && resource.id === change.resource_id)
        state.staged[key] = resource
    }
  }
  state.cursor = page.next_cursor
  if (!page.has_more) {
    state.published = structuredClone(state.staged)
    state.publishedRevision = page.through_revision
    state.throughRevision = null
  }
  return page.has_more
}

async function complete(props: Parameters<typeof advance>[0]) {
  for (const attempt of Array.from({ length: 100 }, (_, index) => index)) {
    if (!(await advance(props))) return
    expect(attempt).toBeLessThan(99)
  }
  throw new Error("Company feed did not complete")
}

async function snapshot(props: {
  request: Awaited<ReturnType<typeof fixture>>["request"]
  revision: number
  effectiveOn: string
}) {
  const collected: z.infer<typeof consumerSchema>["published"] = {}
  for (const path of new Set(paths.values())) {
    const response = snapshotSchema.parse(
      await props.request(
        `/${path}?${new URLSearchParams({
          organization_revision: String(props.revision),
          effective_on: props.effectiveOn,
        }).toString()}`,
      ),
    )
    expect(response.organizationRevision).toBe(props.revision)
    for (const resource of response.resources)
      collected[`${resource.type}:${resource.id}`] = resource
  }
  return collected
}

test("独立した利用者が変更APIと公開台帳だけで属性・期間を再構築し、中断中の会社版を公開しない", async () => {
  const f = await fixture()
  await f.write(1, resources(1))
  await f.write(2, resources(2))
  const first = consumer()
  const second = consumer()
  const request = f.request
  const effectiveOn = "2030-06-01"
  expect(await advance({ request, consumer: first, limit: 1, effectiveOn })).toBe(true)
  expect(first.publishedRevision).toBe(0)
  expect(first.published).toEqual({})
  expect(first.throughRevision).toBe(2)
  const resumed = consumerSchema.parse(JSON.parse(JSON.stringify(first)))
  await f.write(3, [
    {
      ...resources(2)[0]!,
      revision: 3,
      effectiveFrom: restoreCalendarDate("2030-07-01"),
      attributes: { officialName: "Future name" },
    },
  ])
  await complete({ request, consumer: resumed, limit: 1, effectiveOn })
  expect(resumed.publishedRevision).toBe(2)
  expect(resumed.published).toEqual(await snapshot({ request, revision: 2, effectiveOn }))
  expect(resumed.published["person:person:test"]?.attributes).toEqual({
    officialName: "Corrected name",
  })
  expect(resumed.published["employment:cdc317d0-f2a5-47e3-bbaa-4718f418c374"]?.effectiveTo).toBe(
    "2030-10-01",
  )
  expect(
    resumed.published["assignment:9b4f2d0a-5e6c-4b8d-9f0a-1b2c3d4e5f60"]?.attributes.positionTitle,
  ).toBe("Coordinator")
  expect(
    resumed.published["responsibility-assignment:0c5a3e1b-6f7d-4c9e-8a1b-2c3d4e5f6071"]?.attributes
      .delegationAllowed,
  ).toBe(false)
  await complete({ request, consumer: resumed, limit: 2, effectiveOn })
  await complete({ request, consumer: second, limit: 3, effectiveOn })
  expect(resumed.publishedRevision).toBe(3)
  expect(second.published).toEqual(resumed.published)
  expect(second.published).toEqual(await snapshot({ request, revision: 3, effectiveOn }))
  const saved = structuredClone(second)
  await complete({ request, consumer: second, limit: 3, effectiveOn })
  expect(second).toEqual(saved)
})

test("変更を受信した日と発効日を分け、将来発効・遡及訂正・取消を会社版に固定して取得する", async () => {
  const f = await fixture()
  await f.write(1, resources(1))
  await f.write(2, resources(2))
  await f.write(3, [
    {
      ...resources(2)[0]!,
      revision: 3,
      effectiveFrom: restoreCalendarDate("2030-07-01"),
      attributes: { officialName: "Future name" },
    },
  ])
  await f.write(4, [{ ...resources(2)[3]!, revision: 3, state: "void" }])
  for (const effectiveOn of ["2030-06-01", "2030-08-01", "2030-11-01"]) {
    const state = consumer()
    await complete({ request: f.request, consumer: state, limit: 2, effectiveOn })
    expect(state.publishedRevision).toBe(4)
    expect(state.published).toEqual(
      await snapshot({ request: f.request, revision: 4, effectiveOn }),
    )
    expect(state.published["company-profile:profile:test"]).toBeUndefined()
    expect(state.published["person:person:test"]?.attributes.officialName).toBe(
      effectiveOn === "2030-06-01" ? "Corrected name" : "Future name",
    )
    expect(state.published["employment:cdc317d0-f2a5-47e3-bbaa-4718f418c374"] === undefined).toBe(
      effectiveOn === "2030-11-01",
    )
  }
  const old = await snapshot({ request: f.request, revision: 1, effectiveOn: "2030-11-01" })
  expect(old["person:person:test"]?.attributes.officialName).toBe("Original name")
  expect(old["employment:cdc317d0-f2a5-47e3-bbaa-4718f418c374"]?.effectiveTo).toBeNull()
  expect(old["company-profile:profile:test"]).toBeDefined()
})
