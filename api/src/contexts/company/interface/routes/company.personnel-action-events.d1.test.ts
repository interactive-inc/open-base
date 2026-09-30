import { expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { GET } from "@/contexts/company/interface/routes/company.personnel-action-events"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("人事イベントを記録順に再開でき、訂正元と訂正後の発効日を返す", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "feed:original",
  )
  if (retired instanceof Error) throw retired
  const correction = await f.personnel(
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
    "feed:correction",
  )
  if (correction instanceof Error) throw correction
  const actor = {
    value: CompanyActorValue.restore({
      ...f.creator,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:read"],
      permissions: ["employee:read"],
    }),
  }
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set("companyActor", actor.value)
      await next()
    })
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/events", ...GET)
  const sequence = await f.database
    .prepare("SELECT rowid AS sequence FROM company_personnel_actions WHERE id = ?1")
    .bind(retired.action.id)
    .first<number>("sequence")
  if (sequence === null) throw new Error("event sequence missing")
  const first = await app.request(
    `/events?limit=1&after_sequence=${sequence - 1}`,
    {},
    f.context.env,
  )
  expect(first.status).toBe(200)
  const page = z
    .object({
      data: z.array(z.object({ id: z.string(), corrected_by_action_id: z.string().nullable() })),
      next_sequence: z.number(),
    })
    .parse(await first.json())
  expect(page.data).toEqual([
    { id: retired.action.id, corrected_by_action_id: correction.action.id },
  ])
  const second = await app.request(
    `/events?limit=1&after_sequence=${page.next_sequence}`,
    {},
    f.context.env,
  )
  expect(second.status).toBe(200)
  expect(await second.json()).toMatchObject({
    data: [
      {
        id: correction.action.id,
        corrects_action_id: retired.action.id,
        employment_effect: { kind: "retired", eventOn: "2030-07-31", effectiveOn: "2030-08-01" },
        employment_effect_unresolved: false,
      },
    ],
  })
  expect((await app.request("/events?limit=0", {}, f.context.env)).status).toBe(400)
  expect(
    (await app.request("/events?recorded_since=1960-01-01T00:00:00Z", {}, f.context.env)).status,
  ).toBe(400)
  actor.value = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
    capabilities: ["company:admin"],
  })
  expect((await app.request("/events", {}, f.context.env)).status).toBe(403)
  actor.value = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read"],
  })
  expect((await app.request("/events", {}, f.context.env)).status).toBe(403)
  const unauthenticated = new Hono<CompanyHttpEnvironment>()
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/events", ...GET)
  expect((await unauthenticated.request("/events", {}, f.context.env)).status).toBe(401)
})
