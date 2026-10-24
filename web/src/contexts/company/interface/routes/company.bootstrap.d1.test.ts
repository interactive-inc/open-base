import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { POST as definitionsPOST } from "@/contexts/company/interface/routes/company.definitions"
import { CompanyResponsibilityJournalAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-responsibility-journal.adapter"
import { POST as organizationChangesPOST } from "@/contexts/company/interface/routes/company.organization-changes"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResponsibilityResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-responsibility-resource-projection.adapter"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import { PersonnelActionCompletionPreparationAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action-completion-preparation.adapter"
import { fingerprintPersonnelAction } from "@/contexts/company/domain/definitions/fingerprint-personnel-action.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { POST as companyBootstrapPOST } from "@/contexts/company/interface/routes/company.bootstrap"
import { GET as profileGET } from "@/contexts/company/interface/routes/company.profile"
import { GET as snapshotsGET } from "@/contexts/company/interface/routes/company.organization-snapshots"
import {
  GET as unitsGET,
  POST as unitsPOST,
} from "@/contexts/company/interface/routes/company.organization-units"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import { SystemHTTPException } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST as systemBootstrapPOST } from "@system/interface/routes/system.bootstrap"
import { POST as systemSessionPOST } from "@system/interface/routes/system.sessions"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { hc } from "hono/client"
import { createFactory } from "hono/factory"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import { drizzle } from "drizzle-orm/d1"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/** 組織単位の作成要求の ID。 */
const UNIT_REQUEST_ID = "6f0d3c2a-1b4e-4a7d-9c8e-5d2f1a0b3c41"

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
type BootstrapTestEnvironment = {
  Bindings: SystemHonoEnv["Bindings"] & CompanyHttpEnvironment["Bindings"]
  Variables: SystemHonoEnv["Variables"] & CompanyHttpEnvironment["Variables"]
}
const factory = createFactory<BootstrapTestEnvironment>()
const declaration = {
  name: "First Member",
  code: "FIRST-001",
  organization_name: "Example Company",
  representative_name: "Confirmed Representative",
  initial_responsibilities: z.array(z.enum(["MANAGER", "PEOPLE_OPERATIONS"])).parse([]),
  hire_date: "2026-01-01",
  employment_type: z.enum(["FULL_TIME", "PART_TIME"]).parse("PART_TIME"),
  locale: "ja-JP",
  time_zone: "Asia/Tokyo",
  fiscal_year_start_month: 4,
  reason: "Confirmed initial company facts",
}
type BootstrapState = {
  employees: number
  resources: number
  commands: number
  bootstraps: number
  bindings: number
  periods: number
  assignments: number
  responsibilities: number
  revision: number
}
const responseSchema = z.object({
  employee_id: z.string(),
  account_id: z.string(),
  organization_revision: z.number(),
  replayed: z.boolean(),
})

async function fixture() {
  const database = await createLocalD1Database({ schema: schemaSql })
  // 会社情報を事前設定する製品でも、確認済み入力と一致する場合だけ初期化する。
  await database
    .prepare(
      `UPDATE company_organizations SET name = ?1, representative_name = ?2 WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    .bind(declaration.organization_name, declaration.representative_name)
    .run()
  const clock = { now: new Date() }
  const authorization: {
    organizationIds: string[]
    capabilities: ("company:admin" | "company:read")[]
  } = { organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID], capabilities: ["company:admin"] }
  const environment = {
    DB: database,
    BOOTSTRAP_TOKEN: "company-bootstrap-test-token",
    JWT_SECRET: "company-bootstrap-test-jwt-secret",
    PEPPER_SECRET: "company-bootstrap-test-pepper",
    AUDIT_HMAC_SECRET: "company-bootstrap-test-audit",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
  }
  const observedOn = resolveCompanyBusinessDate({
    now: clock.now.toISOString(),
    timeZone: environment.COMPANY_TIME_ZONE,
  })
  if (observedOn instanceof Error) throw observedOn
  const app = factory
    .createApp()
    .onError((error, context) => {
      if (!(error instanceof SystemHTTPException || error instanceof CompanyHTTPException))
        throw error
      return context.json({ code: error.code, detail: error.detail }, error.status, {
        "content-type": "application/problem+json",
      })
    })
    .use("*", async (context, next) => {
      context.set("now", () => clock.now)
      await next()
    })
    .post("/system/bootstrap", ...systemBootstrapPOST)
    .post("/system/sessions", ...systemSessionPOST)
    .use("/company/*", authenticateSystemAccessToken)
    .use("/company/*", async (context, next) => {
      context.set(
        "companyActor",
        CompanyActorValue.restore({
          accountId: String(context.var.userId),
          employeeId: null,
          organizationIds: authorization.organizationIds,
          capabilities: authorization.capabilities,
        }),
      )
      context.set("companyClock", () => clock.now)
      context.set("database", drizzle(database))
      context.set("auditContext", {
        requestId: "bootstrap-test",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      })
      await next()
    })
    .post("/company/bootstrap", ...companyBootstrapPOST)
    .post("/company/organization-changes", ...organizationChangesPOST)
    .post("/company/definitions", ...definitionsPOST)
    .get("/company/profile", ...profileGET)
    .get("/company/organization-snapshots", ...snapshotsGET)
    .get("/company/organization-units", ...unitsGET)
    .post("/company/organization-units", ...unitsPOST)
  const request: typeof fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      app.request(input, init, { ...environment, NOW: clock.now.toISOString() }),
    { preconnect: fetch.preconnect },
  )
  const client = hc<typeof app>("http://company.test", { fetch: request })
  expect(
    Number(
      (
        await client.system.bootstrap.$post({
          json: {
            token: environment.BOOTSTRAP_TOKEN,
            email: "root@example.com",
            password: "correct horse battery staple",
          },
        })
      ).status,
    ),
  ).toBe(201)
  const session = await client.system.sessions.$post({
    json: { subject: "root@example.com", password: "correct horse battery staple" },
  })
  expect(Number(session.status)).toBe(201)
  const token = z.object({ access_token: z.string() }).parse(await session.json()).access_token
  const headers = { authorization: `Bearer ${token}` }
  const post = (body = declaration, key = "company:first") =>
    client.company.bootstrap.$post({ header: { "idempotency-key": key }, json: body }, { headers })
  const createUnit = () =>
    client.company["organization-units"].$post(
      { json: { name: "Department", code: "DEPT", parent_code: null } },
      { headers: { ...headers, "idempotency-key": UNIT_REQUEST_ID } },
    )
  const state = () =>
    database
      .prepare(`SELECT
    (SELECT count(*) FROM company_employees) AS employees,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_command_receipts) AS commands,
    (SELECT count(*) FROM company_bootstrap_receipts) AS bootstraps,
    (SELECT count(*) FROM company_organization_resource_bindings) AS bindings,
    (SELECT count(*) FROM company_organization_unit_period_versions) AS periods,
    (SELECT count(*) FROM company_organization_assignment_period_versions) AS assignments,
    (SELECT count(*) FROM company_organization_responsibility_period_versions) AS responsibilities,
    (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS revision`)
      .first<BootstrapState>()
  return {
    database,
    clock,
    environment,
    authorization,
    app,
    client,
    headers,
    post,
    createUnit,
    state,
    observedOn,
  }
}

describe("Company bootstrap through System authentication", () => {
  test("会社を確認した日の組織期間境界で、最初の所属も人事発令から終了できる", async () => {
    const f = await fixture()
    const response = await f.post()
    expect(Number(response.status)).toBe(201)
    const created = responseSchema.parse(await response.json())
    const employeeId = restoreWorkforceId("employee", created.employee_id)
    const context: CompanyContext = {
      env: { ...f.environment, NOW: f.clock.now.toISOString() },
      var: {
        database: drizzle(f.database),
        auditContext: {
          requestId: "bootstrap-lifecycle",
          clientName: "api",
          clientIp: null,
          externalRequestId: null,
        },
      },
    }
    const revisions = await new EmployeeLifecycleAdapter(context).loadRevisions(employeeId)
    if (revisions instanceof Error) throw revisions
    const code = await f.database
      .prepare(
        "SELECT code FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
      )
      .first<string>("code")
    if (code === null) throw new Error("root code missing")
    const command = {
      session: {
        accountId: zAccountId.parse(created.account_id),
        employeeId,
        hasPermission: (permission: string) => permission === "employee:lifecycle:apply",
      },
      employeeId,
      idempotencyKey: "bootstrap:end-assignment",
      expectedEmployeeRevision: revisions.employeeRevision,
      expectedOrganizationRevision: revisions.organizationRevision,
      input: {
        kind: "assignment_ended",
        employeeCode: declaration.code,
        eventOn: restoreCalendarDate(f.observedOn),
        departmentCode: code,
        assignmentType: "primary",
      },
    } satisfies Parameters<DirectPersonnelActionAdapter["apply"]>[0]
    expect(await new DirectPersonnelActionAdapter(context).apply(command)).toMatchObject({
      replayed: false,
    })
    expect(await new DirectPersonnelActionAdapter(context).apply(command)).toMatchObject({
      replayed: true,
    })
    expect(
      await f.database
        .prepare(
          "SELECT state, effective_from FROM company_resource_heads WHERE resource_type = 'assignment'",
        )
        .first<{ state: string; effective_from: string }>(),
    ).toEqual({ state: "void", effective_from: f.observedOn })
  })
  test("明示した会社文脈と雇用を公開し、元のルート履歴を保ち、会社責務を自動付与しない", async () => {
    const f = await fixture()
    const original = await f.database
      .prepare("SELECT * FROM company_organization_unit_period_versions")
      .first<Record<string, unknown>>()
    const response = await f.post()
    expect(Number(response.status)).toBe(201)
    const created = responseSchema.parse(await response.json())
    expect(created).toMatchObject({
      employee_id: expect.any(String),
      organization_revision: 3,
      replayed: false,
    })
    expect(await f.state()).toEqual({
      employees: 1,
      resources: 9,
      commands: 3,
      bootstraps: 1,
      bindings: 1,
      periods: 3,
      assignments: 1,
      responsibilities: 0,
      revision: 3,
    })
    expect(
      await f.database
        .prepare(
          "SELECT * FROM company_organization_unit_period_versions WHERE period_id = (SELECT period_id FROM company_organization_unit_period_versions WHERE revision = 2) AND revision = 1",
        )
        .first<Record<string, unknown>>(),
    ).toEqual(original)
    expect(
      await f.database
        .prepare("SELECT employment_type, hire_date FROM company_employments")
        .first<{ employment_type: string; hire_date: string }>(),
    ).toEqual({ employment_type: "PART_TIME", hire_date: declaration.hire_date })
    expect(
      await f.database
        .prepare(`SELECT head.state, head.effective_from, binding.period_revision,
      json_extract(head.attributes_json, '$.employeeId') AS employee_id,
      json_extract(head.attributes_json, '$.organizationUnitId') AS organization_unit_id
      FROM company_resource_heads head JOIN company_assignment_period_bindings binding ON binding.resource_id = head.resource_id
      WHERE head.resource_type = 'assignment'`)
        .first(),
    ).toMatchObject({
      state: "active",
      effective_from: declaration.hire_date,
      period_revision: 1,
      employee_id: created.employee_id,
      organization_unit_id: original?.organization_unit_id,
    })
    const profile = await f.client.company.profile.$get(
      { header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID }, query: {} },
      { headers: f.headers },
    )
    expect(Number(profile.status)).toBe(200)
    const beforeConfirmation = await f.client.company.profile.$get(
      {
        header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
        query: { effective_on: declaration.hire_date },
      },
      { headers: f.headers },
    )
    expect(Number(beforeConfirmation.status)).toBe(200)
    expect(await beforeConfirmation.json()).toMatchObject({ resources: [] })
    expect(await profile.json()).toMatchObject({
      organizationRevision: 3,
      resources: [
        {
          attributes: {
            displayName: declaration.organization_name,
            representativeName: declaration.representative_name,
            locale: "ja-JP",
            timeZone: "Asia/Tokyo",
            fiscalYearStartMonth: 4,
          },
        },
      ],
    })
    const snapshot = await f.client.company["organization-snapshots"].$get(
      {
        header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
        query: { as_of: f.observedOn },
      },
      { headers: f.headers },
    )
    expect(Number(snapshot.status)).toBe(200)
    expect(await snapshot.json()).toMatchObject({
      resources: [
        {
          type: "assignment",
          revision: 1,
          effectiveFrom: declaration.hire_date,
          attributes: { employeeId: created.employee_id, assignmentType: "PRIMARY" },
        },
        {
          revision: 1,
          attributes: { officialName: declaration.organization_name, kind: "COMPANY" },
        },
      ],
    })
    const action = await f.database
      .prepare("SELECT payload_fingerprint, summary_json FROM company_personnel_actions")
      .first<{ payload_fingerprint: string; summary_json: string }>()
    if (action === null) throw new Error("initial action missing")
    expect(JSON.parse(action.summary_json)).toMatchObject({
      employmentType: "PART_TIME",
      actorAccountId: created.account_id,
      reason: declaration.reason,
    })
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(action.summary_json),
    )
    expect(action.payload_fingerprint).toBe(
      [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    )
    expect(Number((await f.createUnit()).status)).toBe(201)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_organization_resource_mismatches")
        .first<number>("count"),
    ).toBe(0)
    const before = await f.state()
    f.clock.now = new Date(f.clock.now.getTime() + 86_400_000)
    f.environment.COMPANY_TIME_ZONE = "UTC"
    const replay = await f.post()
    expect(Number(replay.status)).toBe(200)
    expect(await replay.json()).toEqual({ ...created, replayed: true })
    expect(await f.state()).toEqual(before)
    expect(Number((await f.post({ ...declaration, name: "Different" })).status)).toBe(409)
  })

  test.each(["company-profile", "unit-period", "assignment", "assignment-binding", "receipt"])(
    "%sの保存失敗を全取消し、同じ依頼で再試行する",
    async (stage) => {
      const f = await fixture()
      const before = await f.state()
      const definitions = new Map([
        [
          "company-profile",
          "BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'company-profile'",
        ],
        [
          "unit-period",
          "BEFORE INSERT ON company_organization_unit_period_versions WHEN NEW.revision = 2",
        ],
        ["receipt", "BEFORE INSERT ON company_bootstrap_receipts"],
        [
          "assignment",
          "BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'assignment'",
        ],
        ["assignment-binding", "BEFORE INSERT ON company_assignment_period_bindings"],
      ])
      const definition = definitions.get(stage)
      if (definition === undefined) throw new Error("stage missing")
      await execSql(
        f.database,
        `CREATE TRIGGER reject_initial_company ${definition} BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;`,
      )
      expect(Number((await f.post()).status)).toBe(503)
      expect(await f.state()).toEqual(before)
      expect(
        await f.database
          .prepare("SELECT count(*) AS count FROM system_bootstrap_state")
          .first<number>("count"),
      ).toBe(1)
      await execSql(f.database, "DROP TRIGGER reject_initial_company")
      expect(Number((await f.post()).status)).toBe(201)
    },
  )

  test("同じ初期化の同時実行は一回だけ保存し、別の依頼は競合として返す", async () => {
    const f = await fixture()
    const responses = await Promise.all([f.post(), f.post()])
    expect(responses.map((response) => Number(response.status)).toSorted((a, b) => a - b)).toEqual([
      200, 201,
    ])
    expect(await f.state()).toMatchObject({ employees: 1, bootstraps: 1, revision: 3 })
    expect(Number((await f.post(declaration, "different-command")).status)).toBe(409)
    const erased = await f.database
      .prepare("DELETE FROM company_bootstrap_receipts")
      .run()
      .catch((cause: unknown) => cause)
    if (!(erased instanceof Error)) throw new Error("bootstrap receipt was deleted")
    expect(erased.message).toContain("immutable")
  })

  test("代表者を従業員から推測せず、明示した責務だけを確認当日から割り当てる", async () => {
    const f = await fixture()
    const response = await f.post({
      ...declaration,
      initial_responsibilities: ["MANAGER", "PEOPLE_OPERATIONS"],
    })
    expect(Number(response.status)).toBe(201)
    expect(
      await f.database
        .prepare(
          `SELECT name, representative_name FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
        )
        .first<{ name: string; representative_name: string }>(),
    ).toEqual({
      name: declaration.organization_name,
      representative_name: declaration.representative_name,
    })
    const responsibilities = await f.database
      .prepare(
        "SELECT responsibility_type, starts_on FROM company_organization_responsibility_period_versions ORDER BY responsibility_type",
      )
      .all<{ responsibility_type: string; starts_on: string }>()
    expect(responsibilities.results).toEqual([
      { responsibility_type: "MANAGER", starts_on: f.observedOn },
      { responsibility_type: "PEOPLE_OPERATIONS", starts_on: f.observedOn },
    ])
    const proof = await f.database
      .prepare(
        "SELECT operation.request_fingerprint AS actual, receipt.fingerprint AS expected FROM company_organization_change_operations operation JOIN company_bootstrap_receipts receipt ON receipt.actor_account_id = operation.actor_account_id WHERE operation.reason = ?1",
      )
      .bind(declaration.reason)
      .first<{ actual: string; expected: string }>()
    if (proof === null) throw new Error("initial authority proof missing")
    expect(proof.actual).toBe(proof.expected)
  })

  test("認証・会社範囲・管理資格を参照済みの再送にも適用する", async () => {
    const f = await fixture()
    expect(
      Number(
        (
          await f.client.company.bootstrap.$post({
            header: { "idempotency-key": "company:first" },
            json: declaration,
          })
        ).status,
      ),
    ).toBe(401)
    f.authorization.organizationIds = ["01900060-0000-7000-8000-12268fccf2cc"]
    expect(Number((await f.post()).status)).toBe(403)
    f.authorization.organizationIds = [COMPANY_DEFAULT_ORGANIZATION_ID]
    f.authorization.capabilities = ["company:read"]
    expect(Number((await f.post()).status)).toBe(403)
    f.authorization.capabilities = ["company:admin"]
    expect(Number((await f.post()).status)).toBe(201)
    f.authorization.organizationIds = ["01900060-0000-7000-8000-12268fccf2cc"]
    expect(Number((await f.post()).status)).toBe(403)
  })

  test("確認なしの旧入力・未来の入社・実行環境と異なるtimezoneを保存しない", async () => {
    const f = await fixture()
    const invalid = await f.client.company.bootstrap.$post(
      { header: { "idempotency-key": "company:first" }, json: declaration },
      { headers: f.headers, init: { body: JSON.stringify({ name: "First Member" }) } },
    )
    expect(Number(invalid.status)).toBe(400)
    expect(Number((await f.post({ ...declaration, hire_date: "2999-01-01" })).status)).toBe(422)
    expect(Number((await f.post({ ...declaration, time_zone: "UTC" })).status)).toBe(409)
    expect(await f.state()).toMatchObject({
      employees: 0,
      resources: 0,
      bootstraps: 0,
      revision: 0,
    })
  })

  test("既存の会社名や部署を初期化で上書きしない", async () => {
    const f = await fixture()
    expect(
      Number(
        (await f.post({ ...declaration, representative_name: "Other Representative" })).status,
      ),
    ).toBe(409)
    expect(
      Number((await f.post({ ...declaration, organization_name: "Other Company" })).status),
    ).toBe(409)
    await execSql(
      f.database,
      `UPDATE company_organizations SET name = 'Existing Company' WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
    )
    expect(Number((await f.post()).status)).toBe(409)
    expect(
      await f.database
        .prepare(
          `SELECT name FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
        )
        .first<string>("name"),
    ).toBe("Existing Company")
    await f.database
      .prepare(
        `UPDATE company_organizations SET name = ?1 WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .bind(declaration.organization_name)
      .run()
    expect(Number((await f.createUnit()).status)).toBe(201)
    expect(Number((await f.post()).status)).toBe(409)
    expect(await f.state()).toMatchObject({ employees: 0, resources: 0, periods: 2 })
  })

  test.each(["organization", "profile"])("確認直後の%s変更も同じbatchで検出する", async (kind) => {
    const f = await fixture()
    const adapter = new OrganizationResourceAdoptionSnapshotAdapter(f.database)
    const prepare = adapter.prepareGuard.bind(adapter)
    const interception = spyOn(
      OrganizationResourceAdoptionSnapshotAdapter.prototype,
      "prepareGuard",
    ).mockImplementationOnce((snapshot) => {
      const guard = prepare(snapshot)
      const batch = f.database.batch.bind(f.database)
      spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
        if (kind === "organization") expect(Number((await f.createUnit()).status)).toBe(201)
        else
          await execSql(
            f.database,
            `UPDATE company_organizations SET representative_name = 'Changed Representative' WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
          )
        return batch(statements)
      })
      return guard
    })
    try {
      expect(Number((await f.post()).status)).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toMatchObject({
      employees: 0,
      resources: 0,
      bootstraps: 0,
      periods: kind === "organization" ? 2 : 1,
    })
  })
})

async function responsibilityLifecycleFixture() {
  const f = await fixture()
  const response = await f.post({ ...declaration, initial_responsibilities: ["PEOPLE_OPERATIONS"] })
  expect(Number(response.status)).toBe(201)
  const created = responseSchema.parse(await response.json())
  const employeeId = restoreWorkforceId("employee", created.employee_id)
  const context: CompanyContext = {
    env: { ...f.environment, NOW: f.clock.now.toISOString() },
    var: {
      database: drizzle(f.database),
      auditContext: {
        requestId: "responsibility-lifecycle",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  const code = await f.database
    .prepare(
      "SELECT code FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<string>("code")
  if (code === null) throw new Error("root code missing")
  const apply = async (
    input: Parameters<DirectPersonnelActionAdapter["apply"]>[0]["input"],
    key: string,
  ) => {
    const revisions = await new EmployeeLifecycleAdapter(context).loadRevisions(employeeId)
    if (revisions instanceof Error) throw revisions
    return new DirectPersonnelActionAdapter(context).apply({
      session: {
        accountId: zAccountId.parse(created.account_id),
        employeeId,
        hasPermission: (permission: string) => permission === "employee:lifecycle:apply",
      },
      employeeId,
      idempotencyKey: key,
      expectedEmployeeRevision: revisions.employeeRevision,
      expectedOrganizationRevision: revisions.organizationRevision,
      input,
    })
  }
  const responsibilities = async () =>
    (
      await f.database
        .prepare(`SELECT responsibility_type, starts_on, ends_on, is_void, revision
    FROM company_organization_responsibility_period_versions current WHERE revision = (
      SELECT max(revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = current.period_id)
    ORDER BY responsibility_type`)
        .all()
    ).results
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const publicResource = async (responsibilityType = "PEOPLE_OPERATIONS") => {
    const id = await f.database
      .prepare(
        "SELECT resource_id FROM company_responsibility_resource_bindings WHERE employee_id = ?1 AND responsibility_type = ?2 ORDER BY recorded_at DESC LIMIT 1",
      )
      .bind(employeeId, responsibilityType)
      .first<string>("resource_id")
    if (id === null) throw new Error("public responsibility missing")
    const history = await repository.findEmploymentDependentHistory(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      (await f.state())?.revision ?? 0,
    )
    if (history instanceof Error) throw history
    const resource = history
      .filter((resource) => resource.type === "responsibility-assignment" && resource.id === id)
      .toSorted((left, right) => right.revision - left.revision)[0]
    if (resource === undefined) throw new Error("public responsibility history missing")
    return {
      organizationId: resource.organizationId,
      type: "responsibility-assignment" as const,
      id: resource.id,
      revision: resource.revision,
      state: resource.state,
      effectiveFrom: resource.effectiveFrom,
      effectiveTo: resource.effectiveTo,
      attributes: z
        .object({
          responsibilityId: z.string(),
          holderType: z.enum(["employee", "organizational-office", "collective-body"]),
          holderId: z.string(),
          authorityScopeId: z.string().nullable(),
          delegationAllowed: z.boolean(),
        })
        .parse(resource.attributes),
    }
  }
  const writePublic = async (
    resources: Parameters<
      (typeof f.client.company)["organization-changes"]["$post"]
    >[0]["json"]["resources"],
    key: string,
    revision?: number,
  ) =>
    f.client.company["organization-changes"].$post(
      {
        header: {
          "idempotency-key": key,
          "if-match": String(revision ?? (await f.state())?.revision),
          "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
        },
        json: { reason: "Confirm responsibility change", resources },
      },
      { headers: f.headers },
    )
  const publicOn = async (date: string) => {
    const snapshot = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["responsibility-assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  return {
    ...f,
    apply,
    responsibilities,
    code,
    context,
    employeeId,
    accountId: created.account_id,
    publicResource,
    writePublic,
    publicOn,
    repository,
  }
}

test("人事担当の退職と訂正で責務の種類と終了日を保持する", async () => {
  const f = await responsibilityLifecycleFixture()
  const before = await f.state()
  const responsibilitiesBefore = await f.responsibilities()
  await execSql(
    f.database,
    "CREATE TRIGGER fail_responsibility_close BEFORE INSERT ON company_organization_responsibility_period_versions WHEN NEW.revision > 1 BEGIN SELECT RAISE(ABORT, 'responsibility unavailable'); END",
  )
  expect(
    await f.apply(
      {
        kind: "retired",
        employeeCode: declaration.code,
        retirementOn: restoreCalendarDate(f.observedOn),
      },
      "responsibility:retire",
    ),
  ).toBeInstanceOf(Error)
  expect(await f.state()).toEqual(before)
  expect(await f.responsibilities()).toEqual(responsibilitiesBefore)
  await execSql(f.database, "DROP TRIGGER fail_responsibility_close")
  const retired = await f.apply(
    {
      kind: "retired",
      employeeCode: declaration.code,
      retirementOn: restoreCalendarDate(f.observedOn),
    },
    "responsibility:retire",
  )
  expect(retired).toMatchObject({ replayed: false })
  if (retired instanceof Error) throw retired
  const tomorrow = new Date(`${f.observedOn}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const replacementOn = tomorrow.toISOString().slice(0, 10)
  expect(await f.responsibilities()).toMatchObject([
    { responsibility_type: "PEOPLE_OPERATIONS", ends_on: replacementOn, is_void: 0 },
  ])
  const corrected = await f.apply(
    {
      kind: "corrected",
      eventOn: restoreCalendarDate(f.observedOn),
      correctsActionId: retired.action.id,
      reason: "Confirm retirement date",
      replacementAction: {
        kind: "retired",
        employeeCode: declaration.code,
        retirementOn: restoreCalendarDate(replacementOn),
      },
    },
    "responsibility:correct",
  )
  if (corrected instanceof Error) throw corrected
  expect(corrected).toMatchObject({ replayed: false })
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  expect(await f.responsibilities()).toMatchObject([
    {
      responsibility_type: "PEOPLE_OPERATIONS",
      ends_on: tomorrow.toISOString().slice(0, 10),
      is_void: 0,
    },
  ])
})

test("部署責任者の終了は同じ部署の人事担当を終了しない", async () => {
  const f = await responsibilityLifecycleFixture()
  const before = await f.responsibilities()
  expect(
    await f.apply(
      {
        kind: "department_responsibility_ended",
        employeeCode: declaration.code,
        departmentCode: f.code,
        eventOn: restoreCalendarDate(f.observedOn),
      },
      "responsibility:missing-manager",
    ),
  ).toBeInstanceOf(Error)
  expect(await f.responsibilities()).toEqual(before)
})

test("退職では在籍終了後の責任者予約も取消し、別種の責務を終了する", async () => {
  const f = await responsibilityLifecycleFixture()
  const future = new Date(`${f.observedOn}T00:00:00Z`)
  future.setUTCDate(future.getUTCDate() + 1)
  const futureOn = restoreCalendarDate(future.toISOString().slice(0, 10))
  expect(
    await f.apply(
      {
        kind: "department_responsibility_started",
        employeeCode: declaration.code,
        departmentCode: f.code,
        eventOn: futureOn,
      },
      "responsibility:future-manager",
    ),
  ).toMatchObject({ replayed: false })
  const retired = await f.apply(
    {
      kind: "retired",
      employeeCode: declaration.code,
      retirementOn: restoreCalendarDate(f.observedOn),
    },
    "responsibility:retire-future",
  )
  expect(retired).toMatchObject({ replayed: false })
  if (retired instanceof Error) throw retired
  expect(await f.responsibilities()).toMatchObject([
    { responsibility_type: "MANAGER", starts_on: futureOn, is_void: 1 },
    { responsibility_type: "PEOPLE_OPERATIONS", ends_on: futureOn, is_void: 0 },
  ])
  expect(
    await f.apply(
      {
        kind: "corrected",
        eventOn: restoreCalendarDate(f.observedOn),
        correctsActionId: retired.action.id,
        reason: "Restore a confirmed appointment",
        replacementAction: {
          kind: "retired",
          employeeCode: declaration.code,
          retirementOn: futureOn,
        },
      },
      "responsibility:restore-future",
    ),
  ).toMatchObject({ replayed: false })
  future.setUTCDate(future.getUTCDate() + 1)
  expect(await f.responsibilities()).toMatchObject([
    {
      responsibility_type: "MANAGER",
      starts_on: futureOn,
      ends_on: future.toISOString().slice(0, 10),
      is_void: 0,
    },
    {
      responsibility_type: "PEOPLE_OPERATIONS",
      ends_on: future.toISOString().slice(0, 10),
      is_void: 0,
    },
  ])
})

test("部署責任者を終了しても先に任用された別種の責務を保つ", async () => {
  const f = await responsibilityLifecycleFixture()
  const date = new Date(`${f.observedOn}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  const startsOn = restoreCalendarDate(date.toISOString().slice(0, 10))
  expect(
    await f.apply(
      {
        kind: "department_responsibility_started",
        employeeCode: declaration.code,
        departmentCode: f.code,
        eventOn: startsOn,
      },
      "responsibility:manager-start",
    ),
  ).toMatchObject({ replayed: false })
  date.setUTCDate(date.getUTCDate() + 1)
  const endsOn = restoreCalendarDate(date.toISOString().slice(0, 10))
  expect(
    await f.apply(
      {
        kind: "department_responsibility_ended",
        employeeCode: declaration.code,
        departmentCode: f.code,
        eventOn: endsOn,
      },
      "responsibility:manager-end",
    ),
  ).toMatchObject({ replayed: false })
  expect(await f.responsibilities()).toMatchObject([
    { responsibility_type: "MANAGER", starts_on: startsOn, ends_on: endsOn, is_void: 0 },
    { responsibility_type: "PEOPLE_OPERATIONS", ends_on: null, is_void: 0 },
  ])
})

test("申請の実行準備も人事担当の責務を正しい種類で終了する", async () => {
  const f = await responsibilityLifecycleFixture()
  const revisions = await new EmployeeLifecycleAdapter(f.context).loadRevisions(f.employeeId)
  if (revisions instanceof Error) throw revisions
  const input = {
    kind: "retired",
    employeeCode: declaration.code,
    retirementOn: restoreCalendarDate(f.observedOn),
  } satisfies Parameters<DirectPersonnelActionAdapter["apply"]>[0]["input"]
  const prepared = await new PersonnelActionCompletionPreparationAdapter(f.context).prepare({
    session: {
      accountId: zAccountId.parse(f.accountId),
      employeeId: f.employeeId,
      hasPermission: () => true,
    },
    employeeId: f.employeeId,
    input,
    sourceApplicationId: 1,
    requestedByEmployeeId: f.employeeId,
    expectedEmployeeRevision: revisions.employeeRevision,
    expectedOrganizationRevision: revisions.organizationRevision,
    expectedPayloadFingerprint: await fingerprintPersonnelAction(f.employeeId, input),
  })
  expect(prepared).not.toBeInstanceOf(Error)
  if (prepared instanceof Error) throw prepared
  expect(prepared.persistence.projection.schedule.responsibilities).toMatchObject([
    { responsibilityType: "PEOPLE_OPERATIONS" },
  ])
})

test("初期化した責務を公開資格として解決し、確認前の資格は作らない", async () => {
  const f = await responsibilityLifecycleFixture()
  const resource = await f.publicResource()
  const binding = await f.database
    .prepare(
      "SELECT organization_unit_id FROM company_responsibility_resource_bindings WHERE resource_id = ?1",
    )
    .bind(resource.id)
    .first<string>("organization_unit_id")
  if (binding === null) throw new Error("organization missing")
  const resolved = await new CompanyGovernanceAuthorityResolutionAdapter({
    repository: f.repository,
    readActiveAccountIds: async (ids) => new Set(ids.filter((id) => id === f.accountId)),
  }).resolve({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    asOf: restoreCalendarDate(f.observedOn),
    subjectEmployeeId: null,
    criteria: [
      {
        responsibilityCode: "PEOPLE_OPERATIONS",
        scope: { scopeType: "organization-unit", scopeId: binding },
      },
    ],
  })
  expect(resolved).toMatchObject({
    kind: "resolved",
    resolution: { candidates: [{ employeeId: f.employeeId, accountId: f.accountId }] },
  })
  const prior = new Date(Date.parse(`${f.observedOn}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10)
  expect(await f.publicOn(prior)).toEqual([])
})

test("公開責務の終了と再送が同じ期間台帳へ反映され、以後の人事発令とも一致する", async () => {
  const f = await responsibilityLifecycleFixture()
  const endsOn = new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10)
  const source = await f.publicResource()
  const revision = (await f.state())?.revision
  const resources = [{ ...source, revision: source.revision + 1, effectiveTo: endsOn }]
  expect(
    Number((await f.writePublic(resources, "responsibility:public-end", revision)).status),
  ).toBe(201)
  const saved = await f.state()
  expect(
    Number((await f.writePublic(resources, "responsibility:public-end", revision)).status),
  ).toBe(200)
  expect(await f.state()).toEqual(saved)
  expect(await f.responsibilities()).toMatchObject([
    { responsibility_type: "PEOPLE_OPERATIONS", ends_on: endsOn, is_void: 0 },
  ])
  expect(await f.publicOn(endsOn)).toEqual([])
  const started = await f.apply(
    {
      kind: "department_responsibility_started",
      employeeCode: declaration.code,
      eventOn: restoreCalendarDate(f.observedOn),
      departmentCode: f.code,
    },
    "responsibility:public-manager",
  )
  if (started instanceof Error) throw started
  const manager = await f.publicResource("MANAGER")
  expect(manager.state).toBe("active")
  expect(await f.publicOn(f.observedOn)).toHaveLength(2)
  expect(
    await f.apply(
      {
        kind: "department_responsibility_ended",
        employeeCode: declaration.code,
        eventOn: restoreCalendarDate(endsOn),
        departmentCode: f.code,
      },
      "responsibility:manager-ended",
    ),
  ).toMatchObject({ replayed: false })
  expect(await f.publicOn(endsOn)).toEqual([])
})

test("退職・訂正で公開責務と期間台帳を一緒に変更し、再入社だけでは復活させない", async () => {
  const f = await responsibilityLifecycleFixture()
  const retirementOn = restoreCalendarDate(f.observedOn)
  const correctedOn = restoreCalendarDate(
    new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + 86400000).toISOString().slice(0, 10),
  )
  const after = restoreCalendarDate(
    new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + 2 * 86400000).toISOString().slice(0, 10),
  )
  const retired = await f.apply(
    { kind: "retired", employeeCode: declaration.code, retirementOn },
    "responsibility:public-retire",
  )
  if (retired instanceof Error) throw retired
  expect(await f.publicOn(retirementOn)).toHaveLength(1)
  expect(await f.publicOn(correctedOn)).toEqual([])
  expect(
    await f.apply(
      {
        kind: "corrected",
        correctsActionId: retired.action.id,
        eventOn: retirementOn,
        reason: "Correct retirement date",
        replacementAction: {
          kind: "retired",
          employeeCode: declaration.code,
          retirementOn: correctedOn,
        },
      },
      "responsibility:public-correct",
    ),
  ).toMatchObject({ replayed: false })
  expect(await f.publicOn(correctedOn)).toHaveLength(1)
  expect(await f.publicOn(after)).toEqual([])
  expect(
    await f.apply(
      {
        kind: "rehire",
        employeeCode: declaration.code,
        eventOn: after,
        employmentType: "FULL_TIME",
      },
      "responsibility:public-rehire",
    ),
  ).toMatchObject({ replayed: false })
  expect(await f.publicOn(after)).toEqual([])
})

test("公開責務の片側保存と所有者変更を拒否し、履歴と再送結果を保全する", async () => {
  const f = await responsibilityLifecycleFixture()
  const source = await f.publicResource()
  const before = await f.state()
  const end = new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10)
  const interception = spyOn(
    CompanyResponsibilityResourceProjectionAdapter.prototype,
    "prepare",
  ).mockResolvedValueOnce({ responsibilities: [], bindings: [] })
  try {
    expect(
      Number(
        (
          await f.writePublic(
            [{ ...source, revision: source.revision + 1, effectiveTo: end }],
            "responsibility:half-write",
          )
        ).status,
      ),
    ).toBe(422)
  } finally {
    interception.mockRestore()
  }
  expect(await f.state()).toEqual(before)
  expect(
    Number(
      (
        await f.writePublic(
          [
            {
              ...source,
              revision: source.revision + 1,
              attributes: { ...source.attributes, authorityScopeId: null },
            },
          ],
          "responsibility:scope-change",
        )
      ).status,
    ),
  ).toBe(422)
  expect(await f.state()).toEqual(before)
  const deleted = await f.database
    .prepare("DELETE FROM company_responsibility_period_bindings")
    .run()
    .catch((cause: unknown) => cause)
  expect(deleted).toBeInstanceOf(Error)
  expect(await f.state()).toEqual(before)
  expect(
    Number(
      (
        await f.writePublic(
          [{ ...source, revision: source.revision + 1, effectiveTo: end }],
          "responsibility:half-write",
        )
      ).status,
    ),
  ).toBe(201)
})

test("責務の公開保存失敗では初期化を全取消し、同じ依頼で再試行できる", async () => {
  const f = await fixture()
  const before = await f.state()
  await execSql(
    f.database,
    "CREATE TRIGGER reject_initial_responsibility BEFORE INSERT ON company_responsibility_period_bindings BEGIN SELECT RAISE(ABORT, 'injected responsibility binding failure'); END;",
  )
  const input = { ...declaration, initial_responsibilities: ["PEOPLE_OPERATIONS" as const] }
  expect(Number((await f.post(input, "responsibility:bootstrap-failure")).status)).toBe(503)
  expect(await f.state()).toEqual(before)
  expect(
    await f.database
      .prepare("SELECT count(*) FROM company_responsibility_resource_bindings")
      .first<number>("count(*)"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER reject_initial_responsibility")
  expect(Number((await f.post(input, "responsibility:bootstrap-failure")).status)).toBe(201)
})

test("将来の責務予約に空白を残し、人事発令の終了で予約を失わない", async () => {
  const f = await responsibilityLifecycleFixture()
  const date = (days: number) =>
    restoreCalendarDate(
      new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10),
    )
  const source = await f.publicResource()
  expect(
    Number(
      (
        await f.writePublic(
          [{ ...source, revision: 2, effectiveTo: date(1) }],
          "responsibility:gap-start",
        )
      ).status,
    ),
  ).toBe(201)
  expect(
    Number(
      (
        await f.writePublic(
          [{ ...source, revision: 3, effectiveFrom: date(3), effectiveTo: date(5) }],
          "responsibility:future",
        )
      ).status,
    ),
  ).toBe(201)
  expect(await f.publicOn(date(2))).toEqual([])
  expect(await f.publicOn(date(3))).toHaveLength(1)
  expect(
    await f.apply(
      {
        kind: "department_responsibility_started",
        employeeCode: declaration.code,
        eventOn: date(0),
        departmentCode: f.code,
      },
      "responsibility:gap-manager",
    ),
  ).toMatchObject({ replayed: false })
  expect(
    await f.apply(
      {
        kind: "department_responsibility_ended",
        employeeCode: declaration.code,
        eventOn: date(1),
        departmentCode: f.code,
      },
      "responsibility:gap-manager-end",
    ),
  ).toMatchObject({ replayed: false })
  expect(await f.publicOn(date(2))).toEqual([])
  expect(await f.publicOn(date(3))).toHaveLength(1)
  expect(await f.publicOn(date(5))).toEqual([])
  expect(
    await f.database
      .prepare("SELECT count(*) FROM company_responsibility_source_mismatches")
      .first<number>("count(*)"),
  ).toBe(0)
})

test("人事発令の後で公開責務を編集した場合、過去発令の訂正で上書きしない", async () => {
  const f = await responsibilityLifecycleFixture()
  const date = (days: number) =>
    restoreCalendarDate(
      new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + days * 86400000)
        .toISOString()
        .slice(0, 10),
    )
  const started = await f.apply(
    {
      kind: "department_responsibility_started",
      employeeCode: declaration.code,
      eventOn: date(0),
      departmentCode: f.code,
    },
    "responsibility:correct-basis",
  )
  if (started instanceof Error) throw started
  const source = await f.publicResource("MANAGER")
  expect(
    Number(
      (
        await f.writePublic(
          [
            {
              ...source,
              revision: source.revision + 1,
              attributes: { ...source.attributes, delegationAllowed: true },
            },
          ],
          "responsibility:later-edit",
        )
      ).status,
    ),
  ).toBe(201)
  const before = await f.state()
  expect(
    await f.apply(
      {
        kind: "corrected",
        correctsActionId: started.action.id,
        eventOn: date(0),
        reason: "Confirm appointment date",
        replacementAction: {
          kind: "department_responsibility_started",
          employeeCode: declaration.code,
          eventOn: date(1),
          departmentCode: f.code,
        },
      },
      "responsibility:stale-correction",
    ),
  ).toMatchObject({ code: "personnel_action_stale" })
  expect(await f.state()).toEqual(before)
  expect(await f.publicResource("MANAGER")).toEqual({
    ...source,
    revision: source.revision + 1,
    attributes: { ...source.attributes, delegationAllowed: true },
  })
})

test("期間台帳だけを変える人事発令を拒否し、復旧後に同じ依頼を保存できる", async () => {
  const f = await responsibilityLifecycleFixture()
  const before = await f.state()
  const journal = new CompanyResponsibilityJournalAdapter(f.database)
  const prepare = journal.prepare.bind(journal)
  const interception = spyOn(
    CompanyResponsibilityJournalAdapter.prototype,
    "prepare",
  ).mockImplementationOnce(async (props) => {
    const prepared = await prepare(props)
    if (prepared instanceof Error) return prepared
    return { ...prepared, resources: [], bindings: [] }
  })
  const input = {
    kind: "retired" as const,
    employeeCode: declaration.code,
    retirementOn: restoreCalendarDate(f.observedOn),
  }
  try {
    expect(await f.apply(input, "responsibility:private-half-write")).toBeInstanceOf(Error)
  } finally {
    interception.mockRestore()
  }
  expect(await f.state()).toEqual(before)
  expect(await f.apply(input, "responsibility:private-half-write")).toMatchObject({
    replayed: false,
  })
})

test.each(["responsibility", "authority-scope"] as const)(
  "終了済み責務の過去を孤立させる定義変更を拒否する: %s",
  async (type) => {
    const f = await responsibilityLifecycleFixture()
    const source = await f.publicResource()
    const end = restoreCalendarDate(
      new Date(Date.parse(`${f.observedOn}T00:00:00Z`) + 86400000).toISOString().slice(0, 10),
    )
    expect(
      Number(
        (
          await f.writePublic(
            [{ ...source, revision: source.revision + 1, state: "void", effectiveFrom: end }],
            "responsibility:definition-basis",
          )
        ).status,
      ),
    ).toBe(201)
    const definitions = await f.repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: [type],
      effectiveOn: restoreCalendarDate(f.observedOn),
    })
    if (!definitions.ok) throw definitions.cause
    const id =
      type === "responsibility"
        ? source.attributes.responsibilityId
        : source.attributes.authorityScopeId
    const definition = definitions.resources.find((resource) => resource.id === id)
    if (definition === undefined) throw new Error("definition missing")
    const before = await f.state()
    const envelope = {
      organizationId: definition.organizationId,
      id: definition.id,
      revision: definition.revision + 1,
      state: "void" as const,
      effectiveFrom: f.observedOn,
      effectiveTo: null,
    }
    const resource =
      type === "responsibility"
        ? {
            ...envelope,
            type,
            attributes: z
              .object({ code: z.string(), officialName: z.string() })
              .parse(definition.attributes),
          }
        : {
            ...envelope,
            type,
            attributes: z
              .object({ scopeType: z.literal("organization-unit"), scopeId: z.string() })
              .parse(definition.attributes),
          }
    const response = await f.client.company.definitions.$post(
      {
        header: {
          "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
          "idempotency-key": `responsibility:definition-void:${type}`,
          "if-match": String(before?.revision),
        },
        json: {
          reason: "Confirm definition cancellation",
          resources: [resource],
        },
      },
      { headers: f.headers },
    )
    expect(Number(response.status)).toBe(422)
    expect(await f.state()).toEqual(before)
    expect(await f.publicOn(f.observedOn)).toHaveLength(1)
  },
)
