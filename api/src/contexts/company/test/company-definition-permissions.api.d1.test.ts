import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import { GET as PEOPLE_GET } from "@/contexts/company/interface/routes/company.people"
import { POST as ORGANIZATION_POST } from "@/contexts/company/interface/routes/company.organization-changes"
import { GET, POST } from "@/contexts/company/interface/routes/company.definitions"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("等級と役職の限定資格は他の定義を読まず変更せず、再送でも現在資格を検査する", async () => {
  const database = await createLocalD1Database({
    schema:
      readFileSync(
        new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
        "utf8",
      ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  })
  const state: { permissions: CompanyPermissionKey[]; organizationId: string } = {
    permissions: ["master:grade:write"],
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
        employeeId: null,
        organizationIds: [state.organizationId],
        capabilities: [],
        permissions: state.permissions,
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/definitions", ...GET).post("/definitions", ...POST)
  app.get("/people", ...PEOPLE_GET).post("/organization-changes", ...ORGANIZATION_POST)
  const headers = {
    "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
    "Content-Type": "application/json",
  }
  const grade = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "grade",
    id: "grade:test",
    revision: 1,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: { code: "G1", officialName: "Grade" },
  }
  const create = {
    method: "POST",
    headers: { ...headers, "if-match": "0", "idempotency-key": "grade:create" },
    body: JSON.stringify({ reason: "Confirmed grade", resources: [grade] }),
  }
  expect((await app.request("/definitions", create, { DB: database })).status).toBe(201)
  expect((await app.request("/definitions", create, { DB: database })).status).toBe(200)
  for (const suffix of ["", "?type=position", "?id=grade:test"])
    expect((await app.request(`/definitions${suffix}`, { headers }, { DB: database })).status).toBe(
      403,
    )
  expect((await app.request("/people", { headers }, { DB: database })).status).toBe(403)
  expect(
    (
      await app.request(
        "/organization-changes",
        {
          method: "POST",
          headers: { ...headers, "if-match": "1", "idempotency-key": "assignment:forbidden" },
          body: JSON.stringify({
            reason: "Must not grant employee authority",
            resources: [
              {
                ...grade,
                type: "grade-assignment",
                id: "assignment:test",
                attributes: {
                  employeeId: "d47aa389-c802-4a4a-bf7c-c359b764474b",
                  employmentId: "cdc317d0-f2a5-47e3-bbaa-4718f418c374",
                  gradeId: "grade:test",
                },
              },
            ],
          }),
        },
        { DB: database },
      )
    ).status,
  ).toBe(403)
  const read = await app.request(
    "/definitions?type=grade&organization_revision=1",
    { headers },
    { DB: database },
  )
  expect(read.status).toBe(200)
  expect(await read.json()).toMatchObject({ resources: [{ type: "grade", id: "grade:test" }] })
  const mixed = {
    ...create,
    headers: { ...headers, "if-match": "1", "idempotency-key": "mixed:create" },
    body: JSON.stringify({
      reason: "Mixed input",
      resources: [
        { ...grade, id: "grade:other", attributes: { code: "G2", officialName: "Other" } },
        { ...grade, id: "position:test", type: "position" },
      ],
    }),
  }
  expect((await app.request("/definitions", mixed, { DB: database })).status).toBe(403)
  for (const version of [2, 3]) {
    const changed = { ...grade, revision: version, state: version === 3 ? "void" : "active" }
    const response = await app.request(
      "/definitions",
      {
        method: "POST",
        headers: {
          ...headers,
          "if-match": String(version - 1),
          "idempotency-key": `grade:change:${version}`,
        },
        body: JSON.stringify({ reason: "Confirmed change", resources: [changed] }),
      },
      { DB: database },
    )
    expect(response.status).toBe(201)
  }
  state.permissions = []
  expect((await app.request("/definitions", create, { DB: database })).status).toBe(403)
  state.permissions = ["master:position:write"]
  expect((await app.request("/definitions?type=grade", { headers }, { DB: database })).status).toBe(
    403,
  )
  expect(
    (
      await app.request(
        "/definitions",
        {
          method: "POST",
          headers: { ...headers, "if-match": "3", "idempotency-key": "position:create" },
          body: JSON.stringify({
            reason: "Confirmed position",
            resources: [{ ...grade, type: "position", id: "position:test" }],
          }),
        },
        { DB: database },
      )
    ).status,
  ).toBe(201)
  const positions = await app.request("/definitions?type=position", { headers }, { DB: database })
  expect(positions.status).toBe(200)
  expect(await positions.json()).toMatchObject({ resources: [{ type: "position" }] })
  state.organizationId = "01900060-0000-7000-8000-12268fccf2cc"
  expect(
    (await app.request("/definitions?type=position", { headers }, { DB: database })).status,
  ).toBe(403)
})
