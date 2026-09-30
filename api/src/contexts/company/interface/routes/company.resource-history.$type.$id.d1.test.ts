import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { GET } from "@/contexts/company/interface/routes/company.resource-history.$type.$id"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema =
  readFileSync(
    new URL("../../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../../infrastructure/schema/company.sql", import.meta.url), "utf8")

test("資源履歴は取消と訂正元・原資料を含み、会社版を固定して続きから読める", async () => {
  const database = await createLocalD1Database({ schema })
  const repository = new D1CompanyResourceRepository({ database })
  const person = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "person" as const,
    id: "person:history",
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2026-01-01"),
    effectiveTo: null,
    attributes: { officialName: "Original" },
  }
  const record = async (
    revision: number,
    props: { state?: "active" | "void"; name?: string; correction?: boolean } = {},
  ) => {
    const change = CompanyResourceChangeEntity.create({
      commandId: `history:${revision}`,
      expectedRevision: revision - 1,
      actorAccountId: "15e25dcc-26bd-46c1-a7c4-0ab16283c5c5",
      reason: `record ${revision}`,
      recordedAt: revision,
      evidenceReferences: props.correction
        ? [{ context: "system", kind: "document", id: "name:original", version: "1" }]
        : [],
      corrections: props.correction
        ? [{ type: "person", id: person.id, revision, correctsRevision: 1 }]
        : [],
      resources: [
        {
          ...person,
          revision,
          state: props.state ?? "active",
          attributes: { officialName: props.name ?? "Original" },
        },
      ],
    })
    if (change instanceof Error) throw change
    expect(await repository.write(change)).toMatchObject({ kind: "applied" })
  }
  await record(1)
  await record(2, { name: "Corrected", correction: true })

  const access = { allowed: true, employeeRead: true }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
        employeeId: null,
        organizationIds: [
          access.allowed ? COMPANY_DEFAULT_ORGANIZATION_ID : "01900060-0000-7000-8000-12268fccf2cc",
        ],
        capabilities: ["company:read"],
        permissions: access.employeeRead ? ["employee:read"] : ["org:read"],
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.get("/resource-history/:type/:id", ...GET)
  const url = "/resource-history/person/person:history"
  const headers = { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID }
  const first = await app.request(`${url}?limit=1`, { headers }, { DB: database })
  expect(first.status).toBe(200)
  access.employeeRead = false
  expect((await app.request(url, { headers }, { DB: database })).status).toBe(403)
  access.employeeRead = true
  expect(first.headers.get("etag")).toBe('"2"')
  expect(await first.json()).toMatchObject({
    throughRevision: 2,
    hasMore: true,
    nextAfterRevision: 1,
    data: [{ change: { revision: 1 }, resource: { attributes: { officialName: "Original" } } }],
  })

  await record(3, { state: "void", name: "Corrected" })
  const pinned = await app.request(
    `${url}?after_revision=1&through_revision=2&limit=1`,
    { headers },
    { DB: database },
  )
  expect(pinned.status).toBe(200)
  expect(await pinned.json()).toMatchObject({
    throughRevision: 2,
    hasMore: false,
    data: [
      {
        change: {
          revision: 2,
          corrects_revision: 1,
          evidence_references: [
            { context: "system", kind: "document", id: "name:original", version: "1" },
          ],
        },
        resource: { state: "active", attributes: { officialName: "Corrected" } },
      },
    ],
  })
  const current = await app.request(url, { headers }, { DB: database })
  expect(current.status).toBe(200)
  expect(await current.json()).toMatchObject({
    throughRevision: 3,
    data: [
      { resource: { revision: 1 } },
      { resource: { revision: 2 } },
      { resource: { revision: 3, state: "void" } },
    ],
  })

  access.allowed = false
  expect((await app.request(url, { headers }, { DB: database })).status).toBe(403)
  access.allowed = true
  expect(
    (await app.request(`${url}?through_revision=4`, { headers }, { DB: database })).status,
  ).toBe(400)
})
