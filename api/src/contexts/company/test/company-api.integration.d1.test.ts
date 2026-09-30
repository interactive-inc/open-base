import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { POST as POST_ORGANIZATION_CHANGE } from "@/contexts/company/interface/routes/company.organization-changes"
import { GET, POST } from "@/contexts/company/interface/routes/company.people"
import { POST as POST_EMPLOYEES } from "@/contexts/company/interface/routes/company.employees"
import { POST as POST_EMPLOYMENTS } from "@/contexts/company/interface/routes/company.employments"
import {
  GET as GET_DEFINITIONS,
  POST as POST_DEFINITIONS,
} from "@/contexts/company/interface/routes/company.definitions"
import {
  GET as GET_ORGANIZATION_PROFILE,
  PUT as PUT_ORGANIZATION_PROFILE,
} from "@/contexts/company/interface/routes/company.organization-profile"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { Hono } from "hono"
import { hc } from "hono/client"
import { readFileSync } from "node:fs"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const companySql =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")

type TestEnv = {
  Bindings: { DB: D1Database; COMPANY_TIME_ZONE: string }
  Variables: { companyActor: CompanyActorValue; companyClock: () => Date }
}

const actor = CompanyActorValue.restore({
  accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
  employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
  organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
  capabilities: ["company:read", "company:write"],
  permissions: ["employee:read", "employee:attributes:read"],
})

function createClient(database: D1Database, currentActor: CompanyActorValue = actor) {
  const app = new Hono<TestEnv>()
    .use("*", async (context, next) => {
      context.set("companyActor", currentActor)
      context.set("companyClock", () => new Date("2026-09-07T03:00:00.000Z"))
      await next()
    })
    .onError((error, context) => {
      if (!(error instanceof CompanyHTTPException)) throw error

      return context.json({ code: error.code, detail: error.detail }, error.status)
    })
    .get("/company/people", ...GET)
    .post("/company/people", ...POST)
    .post("/company/employees", ...POST_EMPLOYEES)
    .post("/company/employments", ...POST_EMPLOYMENTS)
    .get("/company/definitions", ...GET_DEFINITIONS)
    .post("/company/definitions", ...POST_DEFINITIONS)
    .post("/company/organization-changes", ...POST_ORGANIZATION_CHANGE)
    .get("/company/organization-profile", ...GET_ORGANIZATION_PROFILE)
    .put("/company/organization-profile", ...PUT_ORGANIZATION_PROFILE)

  const request = (
    input: Parameters<typeof app.request>[0],
    init?: Parameters<typeof app.request>[1],
  ) => app.request(input, init, { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" })
  return hc<typeof app>("http://company.test", { fetch: request })
}

async function seedOrganization(database: D1Database): Promise<void> {
  await database
    .prepare(
      `INSERT INTO company_organizations
         (id, revision, name, representative_name, created_at, updated_at)
       VALUES (?, 0, '', '', 0, 0)`,
    )
    .bind(COMPANY_DEFAULT_ORGANIZATION_ID)
    .run()
}

const organizationProfileInput = {
  name: "Example Corporation",
  representativeName: "Alex Example",
  locale: "ja-JP",
  timeZone: "Asia/Tokyo",
  fiscalYearStartMonth: 4,
  version: {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    organizationRevision: 0,
    resourceId: null,
    resourceRevision: 0,
    effectiveOn: "2026-09-07",
    effectiveTo: null,
    sourceFingerprint: "0".repeat(64),
  },
  reason: "Confirmed company profile",
}

const readHeaders = {
  "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
} as const

const writeHeaders = (commandId: string, expectedRevision: number) => ({
  "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
  "idempotency-key": commandId,
  "if-match": `"${expectedRevision}"`,
})

const person = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "person",
  id: "person:1",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  attributes: { officialName: "Test Person" },
} as const

describe("canonical Company API", () => {
  test("限定された従業員編集資格は既存人物を訂正でき、作成・取消・法人変更を拒否する", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    await seedOrganization(database)
    expect(
      (
        await createClient(database).company.people.$post({
          header: writeHeaders("admin:person", 0),
          json: { reason: "本人確認", resources: [person] },
        })
      ).status,
    ).toBe(201)
    const basicEditor = CompanyActorValue.restore({
      accountId: "76e2eea1-f607-4020-90cf-7433ebf4d242",
      employeeId: null,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:workforce:update"],
    })
    const client = createClient(database, basicEditor)
    const creation = await client.company.people.$post({
      header: writeHeaders("basic:create", 1),
      json: {
        reason: "権限外の作成",
        resources: [{ ...person, id: "person:another" }],
      },
    })
    expect(Number(creation.status)).toBe(403)
    const correction = await client.company.people.$post({
      header: writeHeaders("basic:update", 1),
      json: {
        reason: "氏名を確認した",
        resources: [{ ...person, revision: 2, attributes: { officialName: "Updated Person" } }],
      },
    })
    expect(correction.status).toBe(201)
    const cancellation = await client.company.people.$post({
      header: writeHeaders("basic:void", 2),
      json: {
        reason: "権限外の取消",
        resources: [{ ...person, revision: 3, state: "void" }],
      },
    })
    expect(Number(cancellation.status)).toBe(403)

    const legalEntity = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "legal-entity" as const,
      id: "legal-entity:one",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        officialName: "Company",
        jurisdictionCountryCode: "JP",
        registrationNumber: null,
        defaultCurrencyCode: "JPY",
      },
    }
    const mixed = await client.company["organization-changes"].$post({
      header: writeHeaders("basic:mixed", 2),
      json: { reason: "許可外の法人変更", resources: [{ ...person, revision: 3 }, legalEntity] },
    })
    expect(Number(mixed.status)).toBe(403)
    expect(
      (
        await database
          .prepare("SELECT revision FROM company_organizations WHERE id = ?")
          .bind(COMPANY_DEFAULT_ORGANIZATION_ID)
          .first<{ revision: number }>()
      )?.revision,
    ).toBe(2)
  })

  test("限定資格で人物・従業員・雇用の訂正を一つの会社版へ保存する", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    await seedOrganization(database)
    const employee = {
      ...person,
      type: "employee" as const,
      id: "4d1c9a7e-2b3f-4e5a-8c6d-7e8f9a0b1c2d",
      attributes: { personId: person.id, employeeCode: "E001" },
    }
    const employment = {
      ...person,
      type: "employment" as const,
      id: "6e2d0b8f-3c4a-4f6b-9d7e-8f9a0b1c2d3e",
      attributes: {
        employeeId: employee.id,
        status: "ACTIVE" as const,
        employmentType: "FULL_TIME" as const,
      },
    }
    const initial = await createClient(database).company["organization-changes"].$post({
      header: writeHeaders("admin:workforce", 0),
      json: { reason: "原資料で登録を確認", resources: [person, employee, employment] },
    })
    expect(initial.status).toBe(201)

    const basicEditor = CompanyActorValue.restore({
      accountId: "76e2eea1-f607-4020-90cf-7433ebf4d242",
      employeeId: null,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:workforce:update"],
    })
    const updated = await createClient(database, basicEditor).company["organization-changes"].$post(
      {
        header: writeHeaders("basic:workforce", 1),
        json: {
          reason: "氏名・従業員番号・休職を確認",
          resources: [
            { ...person, revision: 2, attributes: { officialName: "Updated Person" } },
            {
              ...employee,
              revision: 2,
              attributes: { ...employee.attributes, employeeCode: "E002" },
            },
            {
              ...employment,
              revision: 2,
              effectiveFrom: "2026-09-07",
              attributes: { ...employment.attributes, status: "ON_LEAVE" as const },
            },
          ],
        },
      },
    )
    expect(updated.status).toBe(201)
    expect(await updated.json()).toMatchObject({ organizationRevision: 2 })
    expect(
      await database
        .prepare("SELECT official_name, employee_code FROM company_employees WHERE id = ?")
        .bind(employee.id)
        .first(),
    ).toMatchObject({ official_name: "Updated Person", employee_code: "E002" })
    expect(
      await database
        .prepare("SELECT status FROM company_employments WHERE id = ?")
        .bind(employment.id)
        .first(),
    ).toMatchObject({ status: "ON_LEAVE" })
  })

  test("存在しない参照先への従業員・雇用登録は422で拒否し、修正後に同じkeyで再試行できる", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    const client = createClient(database)
    const employee = {
      ...person,
      type: "employee" as const,
      id: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
      attributes: { personId: person.id, employeeCode: "E001" },
    }
    const employment: Parameters<
      ReturnType<typeof createClient>["company"]["employments"]["$post"]
    >[0]["json"]["resources"][number] = {
      ...person,
      type: "employment" as const,
      id: "8f3e1c9a-4d5b-4a7c-8e8f-9a0b1c2d3e4f",
      attributes: {
        employeeId: employee.id,
        status: "ACTIVE" as const,
        employmentType: "FULL_TIME",
      },
    }
    const missingPerson = await client.company.employees.$post({
      header: writeHeaders("command:employee", 0),
      json: { reason: "従業員登録", resources: [employee] },
    })
    expect(Number(missingPerson.status)).toBe(422)
    expect(await missingPerson.json()).toMatchObject({ code: "invalid_resource" })
    const missingEmployee = await client.company.employments.$post({
      header: writeHeaders("command:employment", 0),
      json: { reason: "雇用登録", resources: [employment] },
    })
    expect(Number(missingEmployee.status)).toBe(422)
    expect(await missingEmployee.json()).toMatchObject({ code: "invalid_resource" })
    expect(
      (
        await client.company.people.$post({
          header: writeHeaders("command:person", 0),
          json: { reason: "人の登録", resources: [person] },
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await client.company.employees.$post({
          header: writeHeaders("command:employee", 1),
          json: { reason: "従業員登録", resources: [employee] },
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await client.company.employments.$post({
          header: writeHeaders("command:employment", 2),
          json: { reason: "雇用登録", resources: [employment] },
        })
      ).status,
    ).toBe(201)
    const receipts = await database
      .prepare("SELECT recorded_at FROM company_command_receipts ORDER BY organization_revision")
      .all<{ recorded_at: number }>()
    expect(receipts.results).toEqual(
      Array.from({ length: 3 }, () => ({ recorded_at: Date.parse("2026-09-07T03:00:00.000Z") })),
    )
  })

  test("会社情報のないorganizationは404を返す", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    await seedOrganization(database)
    const response = await createClient(database).company["organization-profile"].$get()
    expect(Number(response.status)).toBe(404)
    expect(await response.json()).toMatchObject({ code: "organization_profile_not_configured" })
  })

  test("Company write capabilityなしでは法人プロフィールを更新できない", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    await seedOrganization(database)
    const client = createClient(
      database,
      CompanyActorValue.restore({
        accountId: actor.accountId,
        employeeId: actor.employeeId,
        organizationIds: actor.organizationIds,
        capabilities: ["company:read"],
      }),
    )
    const response = await client.company["organization-profile"].$put({
      header: { "idempotency-key": "company-profile:unauthorized" },
      json: organizationProfileInput,
    })

    expect(Number(response.status)).toBe(403)
    expect(await response.json()).toMatchObject({ code: "forbidden" })
  })

  test("write・replay・readを同じportable D1 contractで実行する", async () => {
    const client = createClient(await createLocalD1Database({ schema: companySql }))
    const request = {
      header: writeHeaders("command:1", 0),
      json: { reason: "initial registration", resources: [person] },
    }

    const created = await client.company.people.$post(request)
    expect(created.status).toBe(201)
    expect(created.headers.get("etag")).toBe('"1"')

    const replayed = await client.company.people.$post(request)
    expect(replayed.status).toBe(200)
    expect(await replayed.json()).toMatchObject({ replayed: true, organizationRevision: 1 })

    const read = await client.company.people.$get({ header: readHeaders, query: {} })
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({
      organizationRevision: 1,
      resources: [person],
    })
  })

  test("LegalEntity配下のSiteとSite配下のWorkplaceを同じ版で登録する", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    await seedLegalEntity(database)
    const client = createClient(database)
    const site = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "site" as const,
      id: "site:main",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        code: "MAIN",
        officialName: "Main Site",
        legalEntityId: "legal-entity:primary",
        kind: "physical" as const,
        timeZone: "Asia/Tokyo",
        countryCode: "JP",
      },
    }
    const workplace = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "workplace" as const,
      id: "workplace:main-office",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        code: "MAIN-OFFICE",
        officialName: "Main Office",
        siteId: "site:main",
        kind: "office" as const,
        organizationUnitId: null,
      },
    }

    const created = await client.company.definitions.$post({
      header: writeHeaders("command:places", 1),
      json: { reason: "register places", resources: [site, workplace] },
    })
    expect(created.status).toBe(201)
    const read = await client.company.definitions.$get({ header: readHeaders, query: {} })
    expect(read.status).toBe(200)
    expect(await read.json()).toMatchObject({
      organizationRevision: 2,
      resources: [site, workplace],
    })
  })

  test("職務・責務scope・合議体を依存順に並べ替えて一つのcommandで登録する", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    await seedOrganization(database)
    const client = createClient(database)
    const job = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "job" as const,
      id: "job:engineer",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: { code: "ENGINEER", officialName: "Engineer" },
    }
    const position = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "position" as const,
      id: "position:engineer",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        code: "ENGINEER",
        officialName: "Engineer Position",
        jobId: "job:engineer",
      },
    }
    const authorityScope = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "authority-scope" as const,
      id: "authority-scope:region",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: { scopeType: "region" as const, regionCode: "NORTH" },
    }
    const collectiveBody = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "collective-body" as const,
      id: "collective-body:board",
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        code: "BOARD",
        officialName: "Board",
        quorumType: "percentage" as const,
        quorumValue: 50,
        decisionRule: "majority" as const,
      },
    }

    const created = await client.company.definitions.$post({
      header: writeHeaders("command:governance-definitions", 0),
      json: {
        reason: "register governance definitions",
        resources: [position, collectiveBody, authorityScope, job],
      },
    })
    expect(created.status).toBe(201)

    const read = await client.company.definitions.$get({ header: readHeaders, query: {} })
    const body = await read.json()
    expect(read.status).toBe(200)
    expect(body.resources).toHaveLength(4)
    const serializedResources = JSON.stringify(body.resources)
    expect(serializedResources).toContain('"type":"authority-scope"')
    expect(serializedResources).toContain('"type":"collective-body"')
    expect(serializedResources).toContain('"type":"job"')
    expect(serializedResources).toContain('"type":"position"')
  })

  test("company:writeだけのactorは従業員系のPeople POSTを従来どおり実行できる", async () => {
    const database = await createLocalD1Database({ schema: companySql })
    const client = createClient(
      database,
      CompanyActorValue.restore({
        accountId: actor.accountId,
        employeeId: actor.employeeId,
        organizationIds: actor.organizationIds,
        capabilities: ["company:write"],
      }),
    )

    const response = await client.company.people.$post({
      header: writeHeaders("command:employee-write", 0),
      json: { reason: "employee write", resources: [person] },
    })

    expect(response.status).toBe(201)
  })

  test("同じidempotency keyの別commandを409へ閉じる", async () => {
    const client = createClient(await createLocalD1Database({ schema: companySql }))
    const header = writeHeaders("command:1", 0)
    await client.company.people.$post({
      header,
      json: { reason: "first", resources: [person] },
    })
    const conflict = await client.company.people.$post({
      header,
      json: {
        reason: "different",
        resources: [{ ...person, attributes: { officialName: "Changed" } }],
      },
    })

    expect(Number(conflict.status)).toBe(409)
    expect(await conflict.json()).toMatchObject({ code: "company_command_conflict" })
  })

  test("People endpointは別resource型をschema境界で拒否する", async () => {
    const client = createClient(await createLocalD1Database({ schema: companySql }))
    const response = await client.company.people.$post({
      header: writeHeaders("command:wrong-resource", 0),
      json: {
        reason: "wrong endpoint",
        resources: [
          {
            ...person,
            // @ts-expect-error People endpoint only accepts person resources
            type: "employee",
          },
        ],
      },
    })

    expect(Number(response.status)).toBe(400)
    expect(await response.json()).toMatchObject({ code: "invalid_company_body" })
  })

  test("同じorganization revisionに固定して訂正・将来取消をas_ofで解決する", async () => {
    const client = createClient(await createLocalD1Database({ schema: companySql }))
    type PersonResource = Parameters<
      typeof client.company.people.$post
    >[0]["json"]["resources"][number]
    const write = (commandId: string, expectedRevision: number, resource: PersonResource) =>
      client.company.people.$post({
        header: writeHeaders(commandId, expectedRevision),
        json: { reason: commandId, resources: [resource] },
      })

    expect((await write("command:initial", 0, person)).status).toBe(201)
    expect(
      (
        await write("command:rename", 1, {
          ...person,
          revision: 2,
          effectiveFrom: "2026-06-01",
          attributes: { officialName: "Renamed Person" },
        })
      ).status,
    ).toBe(201)
    expect(
      (
        await write("command:void", 2, {
          ...person,
          revision: 3,
          state: "void",
          effectiveFrom: "2026-09-01",
        })
      ).status,
    ).toBe(201)

    const beforeRename = await client.company.people.$get({
      header: readHeaders,
      query: { as_of: "2026-03-01" },
    })
    expect(beforeRename.status).toBe(200)
    expect(await beforeRename.json()).toMatchObject({
      organizationRevision: 3,
      resources: [{ revision: 1, attributes: { officialName: "Test Person" } }],
    })

    const afterRename = await client.company.people.$get({
      header: readHeaders,
      query: { effective_on: "2026-07-01" },
    })
    expect(afterRename.status).toBe(200)
    expect(await afterRename.json()).toMatchObject({
      organizationRevision: 3,
      resources: [{ revision: 2, attributes: { officialName: "Renamed Person" } }],
    })

    const afterVoid = await client.company.people.$get({
      header: readHeaders,
      query: { as_of: "2026-10-01" },
    })
    expect(afterVoid.status).toBe(200)
    expect(await afterVoid.json()).toMatchObject({ organizationRevision: 3, resources: [] })
  })

  test("組織変更は上長関係の循環を永続化前に拒否する", async () => {
    const client = createClient(await createLocalD1Database({ schema: companySql }))
    const organizationUnit = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "organization-unit",
      id: "organization-unit-period:root",
      revision: 1,
      state: "active",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "organization-unit:root",
        code: "ROOT",
        officialName: "Company",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      },
    } as const
    const reportingRelation = (employeeId: string, managerEmployeeId: string) => ({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "reporting-relation" as const,
      id: `reporting:${employeeId}`,
      revision: 1,
      state: "active" as const,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      attributes: {
        employeeId,
        managerEmployeeId,
        organizationUnitId: "organization-unit:root",
      },
    })

    const response = await client.company["organization-changes"].$post({
      header: writeHeaders("personnel-action:cycle", 0),
      json: {
        reason: "invalid management cycle",
        resources: [
          organizationUnit,
          reportingRelation("b4b9edaa-1e08-46d5-b0bc-1798cc369fd1", "employee:2"),
          reportingRelation("employee:2", "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1"),
        ],
      },
    })

    expect(Number(response.status)).toBe(422)
    expect(await response.json()).toMatchObject({ code: "invalid_organization" })
  })

  test("hc request contractは不正なbody型をコンパイル時に拒否する", async () => {
    const client = createClient(await createLocalD1Database({ schema: companySql }))
    void ((input: Parameters<typeof client.company.people.$post>[0]) => input)({
      header: writeHeaders("command:invalid", 0),
      // @ts-expect-error reason must be a string
      json: { reason: 1, resources: [person] },
    })
    void ((input: Parameters<typeof client.company.people.$post>[0]) => input)({
      header: writeHeaders("command:wrong-resource", 0),
      json: {
        reason: "wrong endpoint",
        resources: [
          {
            ...person,
            // @ts-expect-error People endpoint only accepts person resources
            type: "employee",
          },
        ],
      },
    })
    void ((input: Parameters<(typeof client.company)["organization-profile"]["$put"]>[0]) => input)(
      {
        header: { "idempotency-key": "company-profile:typed" },
        json: {
          ...organizationProfileInput,
          // @ts-expect-error name must be a string
          name: 1,
          representativeName: "Alex Example",
        },
      },
    )
    expect(client.company.people.$url()).toBeInstanceOf(URL)
  })
})

async function seedLegalEntity(database: D1Database): Promise<void> {
  await seedOrganization(database)
  await database.batch([
    database.prepare(
      `INSERT INTO company_resource_revisions
         (organization_id, resource_type, resource_id, revision, organization_revision,
          state, effective_from, effective_to, attributes_json, command_id,
          actor_account_id, reason, recorded_at)
       VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'legal-entity', 'legal-entity:primary', 1, 1,
         'active', '2026-01-01', NULL,
         '{"officialName":"Example Corporation","jurisdictionCountryCode":"US","registrationNumber":null,"defaultCurrencyCode":"USD"}',
         'command:legal-entity', 'c0975461-26d2-43a1-86d2-124bd000d9c9', 'register legal entity', 1)`,
    ),
    database.prepare(
      `INSERT INTO company_resource_heads
         (organization_id, resource_type, resource_id, revision, organization_revision,
          state, effective_from, effective_to, attributes_json, updated_at)
       VALUES ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'legal-entity', 'legal-entity:primary', 1, 1,
         'active', '2026-01-01', NULL,
         '{"officialName":"Example Corporation","jurisdictionCountryCode":"US","registrationNumber":null,"defaultCurrencyCode":"USD"}', 1)`,
    ),
    database.prepare(
      `UPDATE company_organizations SET revision = 1, updated_at = 1
       WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND revision = 0`,
    ),
  ])
}
