import { expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { DefinitionResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/definition-resource-adoption-snapshot.value"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import * as awards from "@/contexts/company/interface/routes/company.grade-award-archives.$commandId"
import * as employeeAwards from "@/contexts/company/interface/routes/company.grade-award-archives.by-employee.$employeeId"
import * as definitions from "@/contexts/company/interface/routes/company.definition-resource-adoptions.$commandId"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const administrator = CompanyActorValue.restore({
  accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
  employeeId: null,
  organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
  capabilities: ["company:admin"],
})

/** 旧台帳なしで保存済み原文を読む。書込制約はmigrationとstorageの契約テストが検証する。 */
async function fixture() {
  const database = await createLocalD1Database({
    schema: `
    CREATE TABLE company_grade_award_archives (organization_id TEXT, command_id TEXT, employee_id TEXT,
      fingerprint TEXT, actor_account_id TEXT, reason TEXT, observed_on TEXT, observed_company_revision INTEGER,
      snapshot_digest TEXT, source_json TEXT, recorded_at INTEGER);
    CREATE TABLE company_definition_resource_adoptions (organization_id TEXT, command_id TEXT, resource_type TEXT,
      resource_id TEXT, definition_id INTEGER, actor_account_id TEXT, reason TEXT, organization_revision INTEGER,
      observed_on TEXT, snapshot_digest TEXT, source_json TEXT, recorded_at INTEGER);
  `,
  })
  const awardSource = await GradeAwardSourceSnapshotValue.create(
    JSON.stringify({
      organizationRevision: 8,
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      awards: [
        {
          id: 1,
          employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
          gradeId: 1,
          effectiveDate: "2020-01-01",
          reason: " raw reason ",
          createdAt: "unknown",
          observedDefinition: null,
        },
      ],
    }),
  )
  const definitionSource = await DefinitionResourceAdoptionSnapshotValue.create(
    JSON.stringify({
      organizationRevision: 8,
      definition: {
        type: "grade",
        id: 1,
        code: "G1",
        name: "Original grade",
        rank: 1,
        description: null,
        createdAt: "2020-01-01T00:00:00Z",
      },
    }),
  )
  if (awardSource instanceof Error) throw awardSource
  if (definitionSource instanceof Error) throw definitionSource
  await database
    .prepare(`INSERT INTO company_grade_award_archives VALUES
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'archive:one', '9e174baf-3240-4253-9cba-16bc3e431cca', ?1, 'c4b2bc70-8c0d-4dfe-8c44-cb303e75669d', 'Archive reason',
      '2030-01-01', 8, ?2, ?3, 100)`)
    .bind("a".repeat(64), awardSource.props.digest, awardSource.props.sourceJson)
    .run()
  await database
    .prepare(`INSERT INTO company_definition_resource_adoptions VALUES
    ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'definition:one', 'grade', 'grade:one', 1, 'c4b2bc70-8c0d-4dfe-8c44-cb303e75669d', 'Adoption reason',
      9, '2030-01-01', ?1, ?2, 100)`)
    .bind(definitionSource.props.digest, definitionSource.props.sourceJson)
    .run()
  const state: { actor: CompanyActorValue | undefined } = { actor: administrator }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (state.actor !== undefined) context.set("companyActor", state.actor)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app
    .get("/awards/by-employee/:employeeId", ...employeeAwards.GET)
    .get("/awards/:commandId", ...awards.GET)
    .get("/definitions/:commandId", ...definitions.GET)
  return { database, state, request: (path: string) => app.request(path, {}, { DB: database }) }
}

test("旧台帳なしで移行時の原文と主体を読み、会社範囲・管理資格・未認証を区別する", async () => {
  const f = await fixture()
  for (const path of ["/awards/archive:one", "/definitions/definition:one"]) {
    const response = await f.request(path)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      actorAccountId: "c4b2bc70-8c0d-4dfe-8c44-cb303e75669d",
      recordedAt: 100,
    })
    for (const actor of [
      undefined,
      CompanyActorValue.restore({
        accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
        employeeId: null,
        organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
        capabilities: ["company:admin"],
      }),
      CompanyActorValue.restore({
        accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
        employeeId: null,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        capabilities: ["company:read"],
      }),
    ]) {
      f.state.actor = actor
      expect((await f.request(path)).status).toBe(actor === undefined ? 401 : 403)
    }
    f.state.actor = administrator
  }
  expect((await f.request("/awards/missing")).status).toBe(404)
  expect((await f.request("/definitions/missing")).status).toBe(404)
})

test("従業員別の原記録は本人または属性閲覧権限者だけが読める", async () => {
  const f = await fixture()
  const path = "/awards/by-employee/9e174baf-3240-4253-9cba-16bc3e431cca"
  f.state.actor = undefined
  expect((await f.request(path)).status).toBe(401)
  for (const scenario of [
    {
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      organization: COMPANY_DEFAULT_ORGANIZATION_ID,
      permitted: false,
      expected: 200,
    },
    {
      employeeId: "1953cffc-119b-42c7-bbab-82c56499e4ac",
      organization: COMPANY_DEFAULT_ORGANIZATION_ID,
      permitted: false,
      expected: 403,
    },
    {
      employeeId: "1953cffc-119b-42c7-bbab-82c56499e4ac",
      organization: COMPANY_DEFAULT_ORGANIZATION_ID,
      permitted: true,
      expected: 200,
    },
    {
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      organization: "01900060-0000-7000-8000-12268fccf2cc",
      permitted: true,
      expected: 403,
    },
  ]) {
    f.state.actor = CompanyActorValue.restore({
      accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
      employeeId: scenario.employeeId,
      organizationIds: [scenario.organization],
      capabilities: [],
      permissions: scenario.permitted ? ["employee:attributes:read"] : [],
    })
    expect((await f.request(path)).status).toBe(scenario.expected)
  }
})

test("破損した原文は管理者にも返さず、空の履歴として扱わない", async () => {
  const f = await fixture()
  for (const table of ["company_grade_award_archives", "company_definition_resource_adoptions"]) {
    await f.database.prepare(`UPDATE ${table} SET snapshot_digest = ?1`).bind("0".repeat(64)).run()
  }
  expect((await f.request("/awards/archive:one")).status).toBe(503)
  expect((await f.request("/definitions/definition:one")).status).toBe(503)
})
