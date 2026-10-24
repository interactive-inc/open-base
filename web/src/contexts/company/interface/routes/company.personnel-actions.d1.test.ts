import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { GET } from "@/contexts/company/interface/routes/company.personnel-actions"
import { GET as LEGACY_GET } from "@/contexts/company/interface/routes/company.legacy-personnel-action-records"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const f = await createCompanyAssignmentResourceTestContext()
  let actor: CompanyActorValue | undefined = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
    permissions: ["employee:read"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (c, next) => {
      if (actor !== undefined) c.set("companyActor", actor)
      await next()
    })
    .onError((error, c) => {
      if (!(error instanceof CompanyHTTPException)) throw error
      return c.json({ code: error.code, ...error.metadata }, error.status)
    })
    .get("/actions", ...GET)
    .get("/legacy", ...LEGACY_GET)
  return {
    ...f,
    app,
    setHistoryActor: (value: CompanyActorValue | undefined) => {
      actor = value
    },
  }
}
const pageSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      employee_id: z.string(),
      corrects_action_id: z.string().nullable(),
      corrected_by_action_id: z.string().nullable(),
    }),
  ),
  next_cursor: z.string().nullable(),
})

test("実際の退職・訂正を対象と来歴付きで読み、追記中も同じ範囲をページングする", async () => {
  const f = await fixture()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "history:retire",
  )
  if (retired instanceof Error) throw retired
  const request = (query = "") => f.app.request(`/actions${query}`, {}, f.context.env)
  const response = await request("?limit=1")
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toBe("private, no-store")
  const body = await response.json()
  expect(body).toMatchObject({
    data: [
      {
        id: retired.action.id,
        employee_id: f.people[0]?.employeeId,
        kind: "retired",
        event_on: "2030-06-30",
        current_employee: { code: "EMPLOYEE-001", name: "Member 0" },
        recorded_at: "2030-06-01T00:00:00.000Z",
        source_type: "direct",
        source_application_id: null,
        recorded_by_account_id: f.creator.accountId,
        corrected_by_action_id: null,
      },
    ],
  })
  const first = pageSchema.parse(body)
  expect(first.next_cursor).not.toBeNull()
  const corrected = await f.personnel(
    {
      kind: "corrected",
      eventOn: restoreCalendarDate("2030-06-01"),
      correctsActionId: retired.action.id,
      reason: "Correct retirement date",
      replacementAction: {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-07-31"),
      },
    },
    "history:correction",
  )
  if (corrected instanceof Error) throw corrected
  const ids = first.data.map((row) => row.id)
  let cursor = first.next_cursor
  for (let page = 0; cursor !== null && page < 30; page++) {
    const next = await request(`?limit=1&cursor=${encodeURIComponent(cursor)}`)
    expect(next.status).toBe(200)
    const data = pageSchema.parse(await next.json())
    ids.push(...data.data.map((row) => row.id))
    cursor = data.next_cursor
  }
  expect(cursor).toBeNull()
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).not.toContain(corrected.action.id)
  const fresh = pageSchema.parse(await (await request()).json())
  expect(new Set(fresh.data.map((row) => row.id))).toEqual(new Set([...ids, corrected.action.id]))
  expect(fresh.data[0]).toMatchObject({
    id: corrected.action.id,
    corrects_action_id: retired.action.id,
  })
  expect(fresh.data.find((row) => row.id === retired.action.id)?.corrected_by_action_id).toBe(
    corrected.action.id,
  )
  const filtered = await request(
    `?employee_id=${f.people[0]?.employeeId}&from=2030-06-30&to=2030-06-30`,
  )
  expect(pageSchema.parse(await filtered.json()).data.map((row) => row.id)).toEqual([
    retired.action.id,
  ])
  expect(
    pageSchema.parse(await (await request(`?id=${encodeURIComponent(corrected.action.id)}`)).json())
      .data,
  ).toHaveLength(1)
  expect(
    pageSchema.parse(await (await request("?employee_id=employee:missing")).json()).data,
  ).toEqual([])
  for (const query of [
    "?limit=0",
    "?from=2030-07-01&to=2030-06-01",
    "?effective_on=2030-01-01",
    "?cursor=invalid",
    `?limit=2&cursor=${encodeURIComponent(first.next_cursor ?? "")}`,
    `?limit=1&from=2030-01-01&cursor=${encodeURIComponent(first.next_cursor ?? "")}`,
  ]) {
    expect((await request(query)).status).toBe(400)
  }
})

test("会社台帳の読取権限だけ・別organization・未認証では発令履歴を開示しない", async () => {
  const f = await fixture()
  const actors: Array<Parameters<typeof CompanyActorValue.restore>[0]> = [
    {
      ...f.creator,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:read"],
      permissions: [],
    },
    {
      ...f.creator,
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
      capabilities: ["company:read"],
      permissions: ["employee:read"],
    },
  ]
  for (const value of actors) {
    f.setHistoryActor(CompanyActorValue.restore({ ...f.creator, ...value }))
    expect((await f.app.request("/actions", {}, f.context.env)).status).toBe(403)
  }
  f.setHistoryActor(undefined)
  expect((await f.app.request("/actions", {}, f.context.env)).status).toBe(401)
  expect(
    (
      await f.app.request(
        "/actions",
        {
          method: "POST",
          headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
        },
        f.context.env,
      )
    ).status,
  ).toBe(404)
})

test("旧記録は保全して別の読取口へ残し、APIとDBの新規書込を止める", async () => {
  const f = await fixture()
  const guard = await f.database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'company_legacy_personnel_action_write_guard'",
    )
    .first<string>("sql")
  if (guard === null) throw new Error("legacy write guard missing")
  await execSql(f.database, "DROP TRIGGER company_legacy_personnel_action_write_guard")
  const change = CompanyResourceChangeEntity.create({
    actorAccountId: f.creator.accountId,
    commandId: "legacy:existing",
    expectedRevision: await f.companyRevision(),
    reason: "Existing legacy record",
    recordedAt: f.at.getTime(),
    resources: [
      {
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "personnel-action",
        id: "legacy:1",
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2030-01-01"),
        effectiveTo: null,
        attributes: { actionType: "transfer" },
      },
    ],
  })
  if (change instanceof Error) throw change
  expect(
    await new D1CompanyResourceRepository({ database: f.database }).write(change),
  ).toMatchObject({
    kind: "applied",
  })
  await execSql(f.database, guard)
  const before = await f.persisted()
  const retired = await f.app.request(
    "/actions",
    { method: "POST", headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID } },
    f.context.env,
  )
  expect(retired.status).toBe(404)
  const legacy = await f.app.request(
    "/legacy",
    { headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID } },
    f.context.env,
  )
  expect(legacy.status).toBe(200)
  expect(await legacy.json()).toMatchObject({
    resources: [{ id: "legacy:1", attributes: { actionType: "transfer" } }],
  })
  expect(
    pageSchema
      .parse(await (await f.app.request("/actions", {}, f.context.env)).json())
      .data.map((row) => row.id),
  ).not.toContain("legacy:1")
  const attempted = CompanyResourceChangeEntity.create({
    ...change,
    commandId: "legacy:blocked",
    expectedRevision: await f.companyRevision(),
    resources: change.resources.map((row) => ({ ...row, id: "legacy:2" })),
  })
  if (attempted instanceof Error) throw attempted
  expect(
    await new D1CompanyResourceRepository({ database: f.database }).write(attempted),
  ).toMatchObject({
    kind: "unavailable",
  })
  expect(await f.persisted()).toEqual(before)
})
