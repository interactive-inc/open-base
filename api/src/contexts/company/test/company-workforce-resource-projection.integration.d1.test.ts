import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Hono } from "hono"
import { drizzle } from "drizzle-orm/d1"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { DirectPersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/direct-personnel-action.adapter"
import { PersonnelActionAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/personnel-action.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { readCompanyEmploymentStartDates } from "@/contexts/company/interface/operations/read-company-employment-start-dates"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { POST as POST_PEOPLE } from "@/contexts/company/interface/routes/company.people"
import { POST as POST_EMPLOYEES } from "@/contexts/company/interface/routes/company.employees"
import { POST as POST_ORGANIZATION_CHANGES } from "@/contexts/company/interface/routes/company.organization-changes"
import {
  GET as GET_EMPLOYMENT_START_CORRECTIONS,
  POST as POST_EMPLOYMENT_START_CORRECTIONS,
} from "@/contexts/company/interface/routes/company.employment-start-corrections"
import {
  GET as GET_EMPLOYMENTS,
  POST as POST_EMPLOYMENTS,
} from "@/contexts/company/interface/routes/company.employments"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const employeeId = restoreWorkforceId(
  "employee",
  deterministicCompanyId("test-employee", "resource"),
)
const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID
const actor = CompanyActorValue.restore({
  accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
  employeeId: "956ba876-937f-459d-b143-0e2f29d25f74",
  organizationIds: [organizationId],
  capabilities: ["company:read", "company:write"],
  permissions: ["employee:read"],
})
type Resource = {
  organizationId: string
  type: "person" | "employee" | "employment"
  id: string
  revision: number
  state: "active" | "void"
  effectiveFrom: string
  effectiveTo: string | null
  attributes: Record<string, string | null>
}
const person: Resource = {
  organizationId,
  type: "person",
  id: "person:resource",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  attributes: { officialName: "Example Person", email: "you@example.com" },
}
const employee: Resource = {
  ...person,
  type: "employee",
  id: employeeId,
  attributes: { personId: person.id, employeeCode: "RESOURCE-001" },
}
const employment: Resource = {
  ...person,
  type: "employment",
  id: deterministicCompanyId("test-employment", "resource"),
  attributes: { employeeId, status: "ACTIVE", employmentType: "FULL_TIME" },
}

async function fixture(companyActor = actor) {
  const database = await createLocalD1Database({ schema: schemaSql })
  const app = new Hono<{
    Bindings: { DB: D1Database }
    Variables: { companyActor: CompanyActorValue }
  }>()
  app.use("*", async (c, next) => {
    c.set("companyActor", companyActor)
    await next()
  })
  app.onError((error, c) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return c.json({ code: error.code }, error.status)
  })
  app
    .post("/company/people", ...POST_PEOPLE)
    .post("/company/employees", ...POST_EMPLOYEES)
    .post("/company/employments", ...POST_EMPLOYMENTS)
    .post("/company/organization-changes", ...POST_ORGANIZATION_CHANGES)
    .post("/company/employment-start-corrections", ...POST_EMPLOYMENT_START_CORRECTIONS)
    .get("/company/employment-start-corrections", ...GET_EMPLOYMENT_START_CORRECTIONS)
    .get("/company/employments", ...GET_EMPLOYMENTS)
  const write = (
    resource: Resource,
    expectedRevision: number,
    key = `command:${expectedRevision}`,
  ) =>
    app.request(
      `/company/${resource.type === "person" ? "people" : resource.type === "employee" ? "employees" : "employments"}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": organizationId,
          "idempotency-key": key,
          "if-match": `"${expectedRevision}"`,
        },
        body: JSON.stringify({ reason: "Record confirmed workforce facts", resources: [resource] }),
      },
      { DB: database },
    )
  const writeBatch = (
    resources: Resource[],
    expectedRevision: number,
    key: string,
    corrections: ReadonlyArray<{
      type: Resource["type"]
      id: string
      revision: number
      correctsRevision: number
    }> = [],
  ) =>
    app.request(
      "/company/organization-changes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": organizationId,
          "idempotency-key": key,
          "if-match": `"${expectedRevision}"`,
        },
        body: JSON.stringify({
          reason: "Correct confirmed workforce start",
          ...(corrections.length > 0
            ? {
                evidenceReferences: [
                  { context: "system", kind: "document", id: "employment:original", version: "1" },
                ],
                corrections,
              }
            : {}),
          resources,
        }),
      },
      { DB: database },
    )
  const context = (now: string) => ({
    env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", NOW: now },
  })
  const lifecycleContext: CompanyContext = {
    env: context("2026-12-01T00:00:00Z").env,
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "00000000-0000-4000-8000-000000000001",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  return {
    database,
    write,
    writeBatch,
    correctStart: (
      startsOn: string,
      expectedRevision: number,
      key: string,
      correctsRevision = 1,
      evidenceReferences: ReadonlyArray<{
        context: string
        kind: string
        id: string
        version: string
      }> = [{ context: "system", kind: "document", id: "employment:original", version: "1" }],
    ) =>
      app.request(
        "/company/employment-start-corrections",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-company-organization-id": organizationId,
            "idempotency-key": key,
            "if-match": `"${expectedRevision}"`,
          },
          body: JSON.stringify({
            employmentId: employment.id,
            correctsRevision,
            startsOn,
            reason: "Confirm original employment document",
            evidenceReferences,
          }),
        },
        { DB: database },
      ),
    readCorrectionTarget: (throughRevision?: number) =>
      app.request(
        `/company/employment-start-corrections?employment_id=${employment.id}${throughRevision === undefined ? "" : `&organization_revision=${throughRevision}`}`,
        { headers: { "x-company-organization-id": organizationId } },
        { DB: database },
      ),
    directory: (now: string) =>
      new CompanyEmployeeDirectoryReadAdapter(context(now)).findById(employeeId),
    access: (now: string) =>
      new ResolveLiveEmployeeAccessAdapter(context(now)).resolveLiveEmployeeAccess(employeeId),
    readEmployment: (date: string) =>
      app.request(
        `/company/employments?as_of=${date}`,
        {
          headers: { "x-company-organization-id": organizationId },
        },
        { DB: database },
      ),
    listPersonnelActions: () =>
      new PersonnelActionAdapter(lifecycleContext).listForEmployee({
        employeeId,
        from: null,
        to: null,
        anchorRowId: Number.MAX_SAFE_INTEGER,
        position: null,
        limit: 100,
      }),
    applyPersonnelAction: async (
      input: PersonnelActionInput,
      key: string,
      interleave: Readonly<{
        /** 呼出し側が版を確認した後、発令を始める前に実行する。 */
        afterObserved?: () => Promise<void>
        /** 発令が使うDB。準備の途中へ別の確定を差し込むために置き換える。 */
        database?: D1Database
      }> = {},
    ) => {
      const employeeRevision = await database
        .prepare("SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1")
        .bind(employeeId)
        .first<number>("revision")
      const organizationRevision = await database
        .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
        .first<number>("revision")
      if (employeeRevision === null || organizationRevision === null)
        throw new Error("missing lifecycle revision")
      await interleave.afterObserved?.()
      return new DirectPersonnelActionAdapter({
        ...lifecycleContext,
        env: { ...lifecycleContext.env, DB: interleave.database ?? database },
      }).apply({
        session: {
          accountId: zAccountId.parse(actor.accountId),
          employeeId: restoreWorkforceId("employee", "956ba876-937f-459d-b143-0e2f29d25f74"),
          hasPermission: (permission) => permission === "employee:lifecycle:apply",
        },
        employeeId,
        idempotencyKey: key,
        expectedEmployeeRevision: employeeRevision,
        expectedOrganizationRevision: organizationRevision,
        input,
      })
    },
    initialize: async () => {
      expect((await write(person, 0)).status).toBe(201)
      expect((await write(employee, 1)).status).toBe(201)
      expect((await write(employment, 2)).status).toBe(201)
    },
  }
}

describe("公開Company APIから実際の従業員台帳と在籍判定まで", () => {
  test("開始日訂正対象の参照は従業員閲覧資格と存在する会社版を要求する", async () => {
    const f = await fixture()
    expect((await f.readCorrectionTarget()).status).toBe(404)
    await f.initialize()
    expect((await f.readCorrectionTarget(4)).status).toBe(400)
    const limited = await fixture(
      CompanyActorValue.restore({
        accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
        employeeId: "956ba876-937f-459d-b143-0e2f29d25f74",
        organizationIds: [organizationId],
        capabilities: ["company:read"],
      }),
    )
    expect((await limited.readCorrectionTarget()).status).toBe(403)
  })

  test("入社日を初期Person・Employeeより前へ訂正し、同じ会社版の参照を保つ", async () => {
    const f = await fixture()
    await f.initialize()
    const corrected = await f.correctStart("2025-12-01", 3, "correct:initial-start")
    expect({ status: corrected.status, body: await corrected.json() }).toMatchObject({
      status: 201,
      body: { organizationRevision: 4, replayed: false },
    })
    expect((await f.correctStart("2025-12-01", 3, "correct:initial-start")).status).toBe(200)
    expect(await (await f.readCorrectionTarget(3)).json()).toMatchObject({
      organizationRevision: 3,
      startsOn: "2026-01-01",
    })
    expect(await (await f.readCorrectionTarget(4)).json()).toMatchObject({
      organizationRevision: 4,
      startsOn: "2025-12-01",
    })
    const rows = await f.database
      .prepare(`SELECT resource_type, revision, effective_from, corrects_revision
        FROM company_resource_revisions WHERE organization_id = ?1 AND organization_revision = 4
        ORDER BY resource_type, revision`)
      .bind(organizationId)
      .all<{
        resource_type: string
        revision: number
        effective_from: string
        corrects_revision: number | null
      }>()
    expect(
      rows.results.map((row) => [
        row.resource_type,
        row.revision,
        row.effective_from,
        row.corrects_revision,
      ]),
    ).toEqual([
      ["employee", 2, "2025-12-01", 1],
      ["employment", 2, "2025-12-01", 1],
      ["employment", 3, "2026-01-01", 1],
      ["person", 2, "2025-12-01", 1],
    ])
    expect(await (await f.readEmployment("2025-12-15")).json()).toMatchObject({
      resources: [{ id: employment.id }],
    })
    const heads = await f.database
      .prepare(`SELECT resource_type, revision, effective_from FROM company_resource_heads
        WHERE organization_id = ?1 AND resource_type IN ('person', 'employee', 'employment')
        ORDER BY resource_type`)
      .bind(organizationId)
      .all<{ resource_type: string; revision: number; effective_from: string }>()
    expect(heads.results.map((row) => [row.resource_type, row.revision])).toEqual([
      ["employee", 2],
      ["employment", 3],
      ["person", 2],
    ])
    const second = await f.correctStart("2025-11-01", 4, "correct:initial-start-again", 2)
    expect({ status: second.status, body: await second.json() }).toMatchObject({
      status: 201,
      body: { organizationRevision: 5 },
    })
    expect(await (await f.readCorrectionTarget(5)).json()).toMatchObject({
      startsOn: "2025-11-01",
    })
  })

  test("後続の氏名・従業員番号を保ったまま初期の入社日を訂正する", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      (
        await f.write(
          {
            ...person,
            revision: 2,
            effectiveFrom: "2026-06-01",
            attributes: { ...person.attributes, officialName: "Later Name" },
          },
          3,
          "change:later-person",
        )
      ).status,
    ).toBe(201)
    expect(
      (
        await f.write(
          {
            ...employee,
            revision: 2,
            effectiveFrom: "2026-06-01",
            attributes: { ...employee.attributes, employeeCode: "RESOURCE-002" },
          },
          4,
          "change:later-employee",
        )
      ).status,
    ).toBe(201)
    const corrected = await f.correctStart("2025-12-01", 5, "correct:initial-with-later")
    expect({ status: corrected.status, body: await corrected.json() }).toMatchObject({
      status: 201,
      body: { organizationRevision: 6 },
    })
    const heads = await f.database
      .prepare(`SELECT resource_type, revision, effective_from, attributes_json
        FROM company_resource_heads WHERE organization_id = ?1
          AND resource_type IN ('person', 'employee') ORDER BY resource_type`)
      .bind(organizationId)
      .all<{
        resource_type: string
        revision: number
        effective_from: string
        attributes_json: string
      }>()
    expect(
      heads.results.map((row) => [row.resource_type, row.revision, row.effective_from]),
    ).toEqual([
      ["employee", 4, "2026-06-01"],
      ["person", 4, "2026-06-01"],
    ])
    expect(JSON.parse(heads.results[0]?.attributes_json ?? "{}")).toMatchObject({
      employeeCode: "RESOURCE-002",
    })
    expect(JSON.parse(heads.results[1]?.attributes_json ?? "{}")).toMatchObject({
      officialName: "Later Name",
    })
  })

  test("開始日訂正APIは原資料・訂正元を保全し、既存休職と再送を維持する", async () => {
    const f = await fixture()
    expect((await f.write({ ...person, effectiveFrom: "2025-01-01" }, 0)).status).toBe(201)
    expect((await f.write({ ...employee, effectiveFrom: "2025-01-01" }, 1)).status).toBe(201)
    expect(
      (
        await f.writeBatch(
          [
            { ...employment, effectiveTo: "2026-07-01" },
            {
              ...employment,
              revision: 2,
              effectiveFrom: "2026-07-01",
              attributes: { ...employment.attributes, status: "ON_LEAVE" },
            },
          ],
          2,
          "create:employment-with-leave",
        )
      ).status,
    ).toBe(201)
    const targetBefore = await f.readCorrectionTarget()
    expect({ status: targetBefore.status, etag: targetBefore.headers.get("etag") }).toEqual({
      status: 200,
      etag: '"3"',
    })
    expect(await targetBefore.json()).toMatchObject({
      organizationRevision: 3,
      startsOn: "2026-01-01",
      correctsRevision: 1,
      latestRevision: 2,
    })
    expect((await f.correctStart("2025-12-01", 3, "missing-source", 1, [])).status).toBe(400)
    expect((await f.correctStart("2025-12-01", 3, "wrong-source", 2)).status).toBe(422)
    const corrected = await f.correctStart("2025-12-01", 3, "correct:employment-start")
    expect({ status: corrected.status, body: await corrected.json() }).toMatchObject({
      status: 201,
      body: { organizationRevision: 4, replayed: false },
    })
    expect((await f.correctStart("2025-12-01", 3, "correct:employment-start")).status).toBe(200)
    expect(await (await f.readCorrectionTarget()).json()).toMatchObject({
      organizationRevision: 4,
      startsOn: "2025-12-01",
      correctsRevision: 3,
      latestRevision: 4,
    })
    expect(await (await f.readCorrectionTarget(3)).json()).toMatchObject({
      organizationRevision: 3,
      startsOn: "2026-01-01",
      correctsRevision: 1,
    })
    expect((await f.correctStart("2026-02-01", 3, "different-command")).status).toBe(409)
    const corrections = await f.database
      .prepare(`SELECT revision, corrects_revision, reason, evidence_references_json
        FROM company_resource_revisions WHERE organization_id = ?1
        AND resource_type = 'employment' AND resource_id = ?2 AND revision > 2
        ORDER BY revision`)
      .bind(organizationId, employment.id)
      .all<{
        revision: number
        corrects_revision: number | null
        reason: string
        evidence_references_json: string
      }>()
    expect(corrections.results.map((row) => [row.revision, row.corrects_revision])).toEqual([
      [3, 1],
      [4, 1],
    ])
    expect(
      corrections.results.every((row) => row.reason === "Confirm original employment document"),
    ).toBe(true)
    expect(
      corrections.results.every((row) =>
        row.evidence_references_json.includes("employment:original"),
      ),
    ).toBe(true)
    expect(await (await f.readEmployment("2025-12-15")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ACTIVE" } }],
    })
    expect(await (await f.readEmployment("2026-04-01")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ACTIVE" } }],
    })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
    expect((await f.correctStart("2025-11-01", 4, "correct:second-start", 3)).status).toBe(201)
    expect(await (await f.readEmployment("2025-11-15")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ACTIVE" } }],
    })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
  })

  test("開始日訂正APIは後ろ倒しの旧期間を取消し、後続の休職を復活・消去しない", async () => {
    const f = await fixture()
    expect((await f.write(person, 0)).status).toBe(201)
    expect((await f.write(employee, 1)).status).toBe(201)
    expect(
      (
        await f.writeBatch(
          [
            { ...employment, effectiveTo: "2026-07-01" },
            {
              ...employment,
              revision: 2,
              effectiveFrom: "2026-07-01",
              attributes: { ...employment.attributes, status: "ON_LEAVE" },
            },
          ],
          2,
          "create:later-correction-source",
        )
      ).status,
    ).toBe(201)
    expect((await f.correctStart("2026-02-01", 3, "correct:later-start")).status).toBe(201)
    expect(await (await f.readEmployment("2026-01-15")).json()).toMatchObject({ resources: [] })
    expect(await (await f.readEmployment("2026-02-15")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ACTIVE" } }],
    })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
    expect(
      await f.database
        .prepare("SELECT hire_date FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ hire_date: string }>(),
    ).toEqual({ hire_date: "2026-02-01" })
  })

  test("新規雇用の複数revisionを一つの会社版で登録して時点参照を揃える", async () => {
    const f = await fixture()
    expect((await f.write(person, 0)).status).toBe(201)
    expect((await f.write(employee, 1)).status).toBe(201)
    const response = await f.writeBatch(
      [
        employment,
        {
          ...employment,
          revision: 2,
          effectiveFrom: "2026-07-01",
          attributes: { ...employment.attributes, status: "ON_LEAVE" },
        },
      ],
      2,
      "create:employment-history",
    )
    expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 201 })
    expect(await (await f.readEmployment("2026-04-01")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ACTIVE" } }],
    })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
  })

  test("元の入社発令がない雇用の開始日を後ろ倒しすると旧期間を取消して投影を揃える", async () => {
    const f = await fixture()
    await f.initialize()
    const revision = await f.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
    if (revision === null) throw new Error("missing company revision")
    const unlinked = await f.writeBatch(
      [
        { ...employment, revision: 2, state: "void", effectiveTo: "2026-02-01" },
        { ...employment, revision: 3, effectiveFrom: "2026-02-01" },
      ],
      revision,
      "correct:later-employment-start-without-source",
    )
    expect(unlinked.status).toBe(422)
    expect(await unlinked.json()).toMatchObject({ code: "unlinked_start_correction" })
    expect(
      await f.database
        .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
        .bind(organizationId)
        .first<number>("revision"),
    ).toBe(revision)
    expect(
      await f.database
        .prepare("SELECT hire_date FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ hire_date: string }>(),
    ).toEqual({ hire_date: "2026-01-01" })
    const correction = await f.writeBatch(
      [
        { ...employment, revision: 2, state: "void", effectiveTo: "2026-02-01" },
        { ...employment, revision: 3, effectiveFrom: "2026-02-01" },
      ],
      revision,
      "correct:later-employment-start",
      [
        { type: "employment", id: employment.id, revision: 2, correctsRevision: 1 },
        { type: "employment", id: employment.id, revision: 3, correctsRevision: 1 },
      ],
    )
    expect({ status: correction.status, body: await correction.json() }).toMatchObject({
      status: 201,
    })
    expect(
      await f.database
        .prepare("SELECT hire_date FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ hire_date: string }>(),
    ).toEqual({ hire_date: "2026-02-01" })
    expect(await (await f.readEmployment("2026-01-15")).json()).toMatchObject({ resources: [] })
    expect(await (await f.readEmployment("2026-02-15")).json()).toMatchObject({
      resources: [{ id: employment.id, effectiveFrom: "2026-02-01" }],
    })
    expect(
      (
        await f.writeBatch(
          [
            { ...employment, revision: 2, state: "void", effectiveTo: "2026-02-01" },
            { ...employment, revision: 3, effectiveFrom: "2026-02-01" },
          ],
          revision,
          "correct:later-employment-start",
          [
            { type: "employment", id: employment.id, revision: 2, correctsRevision: 1 },
            { type: "employment", id: employment.id, revision: 3, correctsRevision: 1 },
          ],
        )
      ).status,
    ).toBe(200)
    expect(
      await f.applyPersonnelAction(
        {
          kind: "leave_started",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2026-07-01"),
        },
        "later-start:leave",
      ),
    ).toMatchObject({ replayed: false })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
  })

  test("入社日の遡及訂正後に新しい状態変更があっても旧開始日を復活させない", async () => {
    const f = await fixture()
    expect((await f.write({ ...person, effectiveFrom: "2025-01-01" }, 0)).status).toBe(201)
    expect((await f.write({ ...employee, effectiveFrom: "2025-01-01" }, 1)).status).toBe(201)
    expect((await f.write(employment, 2)).status).toBe(201)
    const correction = await f.writeBatch(
      [{ ...employment, revision: 2, effectiveFrom: "2025-12-01" }],
      3,
      "correct:earlier-employment-start",
      [{ type: "employment", id: employment.id, revision: 2, correctsRevision: 1 }],
    )
    if (correction.status !== 201) throw new Error(await correction.text())
    expect(
      await f.applyPersonnelAction(
        {
          kind: "leave_started",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2026-07-01"),
        },
        "earlier-start:leave",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.database
        .prepare("SELECT hire_date, status FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ hire_date: string; status: string }>(),
    ).toEqual({
      hire_date: "2025-12-01",
      status: "ON_LEAVE",
    })
    expect(await (await f.readEmployment("2025-12-15")).json()).toMatchObject({
      resources: [{ id: employment.id, effectiveFrom: "2025-12-01" }],
    })
    expect(await (await f.readEmployment("2026-04-01")).json()).toMatchObject({
      resources: [
        { id: employment.id, effectiveFrom: "2025-12-01", attributes: { status: "ACTIVE" } },
      ],
    })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
    const organizationRevision = await f.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
    if (organizationRevision === null) throw new Error("missing company revision")
    const startsOn = await readCompanyEmploymentStartDates({
      database: f.database,
      organizationId,
      employmentIds: [employment.id],
      organizationRevision,
    })
    expect(startsOn).toBeInstanceOf(Map)
    if (startsOn instanceof Error) throw startsOn
    expect(startsOn.get(employment.id)).toBe(restoreCalendarDate("2025-12-01"))
  })

  test("休職履歴がある雇用の開始日を後ろ倒ししても後続状態を保つ", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      await f.applyPersonnelAction(
        {
          kind: "leave_started",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2026-07-01"),
        },
        "existing:leave",
      ),
    ).toMatchObject({ replayed: false })
    const revision = await f.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
    if (revision === null) throw new Error("missing company revision")
    const correction = [
      { ...employment, revision: 4, state: "void" as const, effectiveTo: "2026-02-01" },
      { ...employment, revision: 5, effectiveFrom: "2026-02-01", effectiveTo: "2026-07-01" },
      {
        ...employment,
        revision: 6,
        effectiveFrom: "2026-07-01",
        attributes: { ...employment.attributes, status: "ON_LEAVE" },
      },
    ]
    const response = await f.writeBatch(correction, revision, "correct:later-start-with-leave", [
      { type: "employment", id: employment.id, revision: 4, correctsRevision: 2 },
      { type: "employment", id: employment.id, revision: 5, correctsRevision: 2 },
    ])
    expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 201 })
    expect(
      await f.database
        .prepare("SELECT hire_date, status FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ hire_date: string; status: string }>(),
    ).toEqual({ hire_date: "2026-02-01", status: "ON_LEAVE" })
    expect(await (await f.readEmployment("2026-01-15")).json()).toMatchObject({ resources: [] })
    expect(await (await f.readEmployment("2026-04-01")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ACTIVE" } }],
    })
    expect(await (await f.readEmployment("2026-07-02")).json()).toMatchObject({
      resources: [{ id: employment.id, attributes: { status: "ON_LEAVE" } }],
    })
  })

  test("元の入社発令がない公開雇用も開始日を前倒しして時点参照と投影を揃える", async () => {
    const f = await fixture()
    await f.initialize()
    const revision = await f.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
    if (revision === null) throw new Error("missing company revision")
    expect(
      Number(
        (
          await f.writeBatch(
            [
              { ...person, revision: 2, effectiveFrom: "2025-12-01" },
              { ...employee, revision: 2, effectiveFrom: "2025-12-01" },
              { ...employment, revision: 2, effectiveFrom: "2025-12-01" },
            ],
            revision,
            "correct:employment-start",
            [
              { type: "person", id: person.id, revision: 2, correctsRevision: 1 },
              { type: "employee", id: employee.id, revision: 2, correctsRevision: 1 },
              { type: "employment", id: employment.id, revision: 2, correctsRevision: 1 },
            ],
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      await f.database
        .prepare("SELECT hire_date FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ hire_date: string }>(),
    ).toEqual({ hire_date: "2025-12-01" })
    expect(await (await f.readEmployment("2025-12-15")).json()).toMatchObject({
      resources: [{ id: employment.id, effectiveFrom: "2025-12-01" }],
    })
    expect(await (await f.readEmployment("2026-01-15")).json()).toMatchObject({
      resources: [
        {
          id: employment.id,
          effectiveFrom: "2025-12-01",
          attributes: { status: "ACTIVE" },
        },
      ],
    })
  })

  test("公開APIで作った雇用への人事発令が公開履歴へ戻り、次の公開writeも続けられる", async () => {
    const f = await fixture()
    await f.initialize()
    const leave: PersonnelActionInput = {
      kind: "leave_started",
      employeeCode: "RESOURCE-001",
      eventOn: restoreCalendarDate("2027-01-01"),
    }
    expect(await f.applyPersonnelAction(leave, "journal:leave")).toMatchObject({ replayed: false })
    expect(await (await f.readEmployment("2026-12-31")).json()).toMatchObject({
      resources: [{ attributes: { status: "ACTIVE", employmentType: "FULL_TIME" } }],
    })
    expect(await (await f.readEmployment("2027-01-01")).json()).toMatchObject({
      resources: [{ attributes: { status: "ON_LEAVE" } }],
    })
    const rowsBefore = await f.database
      .prepare("SELECT count(*) AS total FROM company_resource_revisions")
      .first<number>("total")
    expect(await f.applyPersonnelAction(leave, "journal:leave")).toMatchObject({ replayed: true })
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(rowsBefore)
    const resourceRevision = await f.database
      .prepare("SELECT revision FROM company_resource_heads WHERE resource_id = ?1")
      .bind(employment.id)
      .first<number>("revision")
    const organizationRevision = await f.database
      .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
      .bind(organizationId)
      .first<number>("revision")
    if (resourceRevision === null || organizationRevision === null)
      throw new Error("missing public revision")
    expect(
      (
        await f.write(
          { ...employment, revision: resourceRevision + 1, effectiveFrom: "2027-02-01" },
          organizationRevision,
        )
      ).status,
    ).toBe(201)
    expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ON_LEAVE" })
    expect(await f.access("2027-02-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    const actions = await f.listPersonnelActions()
    expect(actions).not.toBeInstanceOf(Error)
    if (actions instanceof Error) throw actions
    expect(actions.map((action) => action.kind).sort()).toEqual([
      "employment_revised",
      "employment_revised",
      "leave_started",
    ])
    expect(actions.every((action) => !action.corrected)).toBe(true)
  })

  test("休職日の訂正・復職・退職・再入社も公開履歴と同じ日付で解決する", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      await f.applyPersonnelAction(
        {
          kind: "leave_started",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-01-01"),
        },
        "journal:corrected-leave",
      ),
    ).toMatchObject({ replayed: false })
    const actionId = await f.database
      .prepare(
        "SELECT id FROM company_personnel_actions WHERE operation_id = 'journal:corrected-leave'",
      )
      .first<string>("id")
    if (actionId === null) throw new Error("missing leave action")
    expect(
      await f.applyPersonnelAction(
        {
          kind: "corrected",
          eventOn: restoreCalendarDate("2026-12-01"),
          correctsActionId: actionId,
          reason: "Correct the confirmed leave start",
          replacementAction: {
            kind: "leave_started",
            employeeCode: "RESOURCE-001",
            eventOn: restoreCalendarDate("2027-01-15"),
          },
        },
        "journal:correct-leave",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.applyPersonnelAction(
        {
          kind: "returned",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-02-01"),
        },
        "journal:return",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.applyPersonnelAction(
        {
          kind: "retired",
          employeeCode: "RESOURCE-001",
          retirementOn: restoreCalendarDate("2027-03-31"),
        },
        "journal:retire",
      ),
    ).toMatchObject({ replayed: false })
    for (const scenario of [
      { date: "2027-01-01", status: "ACTIVE" },
      { date: "2027-01-15", status: "ON_LEAVE" },
      { date: "2027-02-01", status: "ACTIVE" },
      { date: "2027-04-01", status: "TERMINATED" },
    ])
      expect(await (await f.readEmployment(scenario.date)).json()).toMatchObject({
        resources: [{ attributes: { status: scenario.status } }],
      })
    expect(
      await f.applyPersonnelAction(
        {
          kind: "rehire",
          employmentType: "PART_TIME",
          employeeCode: "RESOURCE-001",
          eventOn: restoreCalendarDate("2027-06-01"),
        },
        "journal:rehire",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.access("2027-05-15T00:00:00Z")).toBeNull()
    expect(await f.access("2027-06-01T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    const current = await f.readEmployment("2027-06-01")
    expect(current.status).toBe(200)
    expect(await current.json()).toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({ attributes: expect.objectContaining({ status: "ACTIVE" }) }),
      ]),
    })
    expect(await f.listPersonnelActions()).not.toBeInstanceOf(Error)
  })

  test("再入社とその訂正の契約区分を保存し、以前の契約の区分を変更しない", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      await f.applyPersonnelAction(
        {
          kind: "retired",
          employeeCode: "RESOURCE-001",
          retirementOn: restoreCalendarDate("2026-03-31"),
        },
        "type:retire",
      ),
    ).not.toBeInstanceOf(Error)
    const input: PersonnelActionInput = {
      kind: "rehire",
      employeeCode: "RESOURCE-001",
      eventOn: restoreCalendarDate("2026-05-01"),
      employmentType: "PART_TIME",
    }
    expect(await f.applyPersonnelAction(input, "type:rehire")).toMatchObject({
      action: { summary: { employmentType: "PART_TIME" } },
      replayed: false,
    })
    expect(await f.applyPersonnelAction(input, "type:rehire")).toMatchObject({ replayed: true })
    expect(
      await f.applyPersonnelAction({ ...input, employmentType: "FULL_TIME" }, "type:rehire"),
    ).toMatchObject({ code: "idempotency_conflict" })
    expect(
      await f.database
        .prepare("SELECT employment_type FROM company_employments WHERE id = ?1")
        .bind(employment.id)
        .first<{ employment_type: string }>(),
    ).toEqual({ employment_type: "FULL_TIME" })
    const oldContract = await f.database
      .prepare(
        "SELECT id, employment_type FROM company_employments WHERE id <> ?1 AND employee_id = ?2",
      )
      .bind(employment.id, employeeId)
      .first<{ id: string; employment_type: string }>()
    expect(oldContract?.employment_type).toBe("PART_TIME")
    expect(await (await f.readEmployment("2026-05-01")).json()).toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({
          attributes: expect.objectContaining({ employmentType: "PART_TIME", status: "ACTIVE" }),
        }),
      ]),
    })
    const actionId = await f.database
      .prepare("SELECT id FROM company_personnel_actions WHERE operation_id = 'type:rehire'")
      .first<string>("id")
    if (actionId === null || oldContract === null) throw new Error("missing rehire record")
    expect(
      await f.applyPersonnelAction(
        {
          kind: "corrected",
          eventOn: restoreCalendarDate("2026-04-01"),
          correctsActionId: actionId,
          reason: "Correct confirmed contract",
          replacementAction: { ...input, employmentType: "FULL_TIME" },
        },
        "type:correct",
      ),
    ).not.toBeInstanceOf(Error)
    expect(await (await f.readEmployment("2026-05-01")).json()).toMatchObject({
      resources: expect.arrayContaining([
        expect.objectContaining({
          state: "active",
          attributes: expect.objectContaining({ employmentType: "FULL_TIME", status: "ACTIVE" }),
        }),
      ]),
    })
    expect(
      await f.database
        .prepare("SELECT employment_type FROM company_employments WHERE id = ?1")
        .bind(oldContract.id)
        .first<{ employment_type: string }>(),
    ).toEqual({ employment_type: "PART_TIME" })
    expect(await f.listPersonnelActions()).not.toBeInstanceOf(Error)
  })

  test("人事発令の公開履歴保存が失敗したら、期間・発令・監査も確定しない", async () => {
    const f = await fixture()
    await f.initialize()
    const tables = [
      "company_personnel_actions",
      "company_employee_status_period_versions",
      "company_resource_revisions",
      "company_command_receipts",
      "system_audit_events",
    ]
    const counts = async () =>
      Promise.all(
        tables.map((table) =>
          f.database.prepare(`SELECT count(*) AS total FROM ${table}`).first<number>("total"),
        ),
      )
    const before = await counts()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_lifecycle_journal BEFORE INSERT ON company_resource_revisions WHEN NEW.command_id LIKE 'lifecycle:%' BEGIN SELECT RAISE(ABORT, 'injected journal failure'); END;",
    )
    const leave: PersonnelActionInput = {
      kind: "leave_started",
      employeeCode: "RESOURCE-001",
      eventOn: restoreCalendarDate("2027-01-01"),
    }
    expect(await f.applyPersonnelAction(leave, "journal:rollback")).toBeInstanceOf(Error)
    expect(await counts()).toEqual(before)
    expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    await execSql(f.database, "DROP TRIGGER reject_lifecycle_journal")
    expect(await f.applyPersonnelAction(leave, "journal:rollback")).toMatchObject({
      replayed: false,
    })
  })

  // 発令と公開writeの確定順は、発令の呼出し側が版を確認する前・確認後・準備中・確定時の4通りがある。
  // どの順でも一方だけが確定し、発令が確認していない状態への検証結果を返さないことを決まった順で確かめる。
  const leaveOnEmploymentEnd: PersonnelActionInput = {
    kind: "leave_started",
    employeeCode: "RESOURCE-001",
    eventOn: restoreCalendarDate("2027-01-01"),
  }
  const shortenEmployment = (f: Awaited<ReturnType<typeof fixture>>) =>
    f.write({ ...employment, revision: 2, effectiveTo: "2027-01-01" }, 3)
  const expectOnlyWriteCommitted = async (f: Awaited<ReturnType<typeof fixture>>, key: string) => {
    expect(await f.access("2027-01-15T00:00:00Z")).toBeNull()
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_personnel_actions WHERE operation_id = ?1")
        .bind(key)
        .first<number>("total"),
    ).toBe(0)
  }

  test("公開writeの確定後に版を確認した発令は、確定済みの雇用期間に対する不正な遷移として拒否する", async () => {
    const f = await fixture()
    await f.initialize()
    expect((await shortenEmployment(f)).status).toBe(201)
    expect(await f.applyPersonnelAction(leaveOnEmploymentEnd, "journal:after-write")).toMatchObject(
      { code: "personnel_action_invalid_transition" },
    )
    await expectOnlyWriteCommitted(f, "journal:after-write")
  })

  test("版の確認後に公開writeが確定したら、古い発令として拒否する", async () => {
    const f = await fixture()
    await f.initialize()
    let written: number | null = null
    const action = await f.applyPersonnelAction(leaveOnEmploymentEnd, "journal:observed", {
      afterObserved: async () => {
        written = (await shortenEmployment(f)).status
      },
    })
    expect(written as number | null).toBe(201)
    expect(action).toMatchObject({ code: "personnel_action_stale" })
    await expectOnlyWriteCommitted(f, "journal:observed")
  })

  test("発令の準備中に公開writeが確定したら、投影の不一致ではなく古い発令として拒否する", async () => {
    const f = await fixture()
    await f.initialize()
    // 発令が公開雇用の版を読んだ直後、次のDB操作の前に公開writeを確定する。
    let armed = false
    let written: number | null = null
    const interleave = async () => {
      if (!armed || written !== null) return
      armed = false
      written = (await shortenEmployment(f)).status
    }
    const statement = (inner: D1PreparedStatement, sql: string): D1PreparedStatement =>
      new Proxy(inner, {
        get(target, property, receiver) {
          if (property === "bind")
            return (...values: unknown[]) => statement(target.bind(...values), sql)
          if (
            property === "first" ||
            property === "all" ||
            property === "run" ||
            property === "raw"
          )
            return async (...args: unknown[]) => {
              await interleave()
              const result = await Reflect.apply(
                Reflect.get(target, property, receiver) as (...values: unknown[]) => unknown,
                target,
                args,
              )
              if (sql.startsWith("SELECT revision, state, effective_from, effective_to"))
                armed = written === null
              return result
            }
          return Reflect.get(target, property, receiver)
        },
      })
    const database = new Proxy(f.database, {
      get(target, property, receiver) {
        if (property === "prepare")
          return (sql: string) => statement(target.prepare(sql), sql.trim())
        if (property === "batch")
          return async (statements: D1PreparedStatement[]) => {
            await interleave()
            return target.batch(statements)
          }
        return Reflect.get(target, property, receiver)
      },
    })
    const action = await f.applyPersonnelAction(leaveOnEmploymentEnd, "journal:preparing", {
      database,
    })
    expect(written as number | null).toBe(201)
    expect(action).toMatchObject({ code: "personnel_action_stale" })
    await expectOnlyWriteCommitted(f, "journal:preparing")
  })

  test("公開writeより先に発令が確定したら、公開writeを版の競合として拒否する", async () => {
    const f = await fixture()
    await f.initialize()
    expect(await f.applyPersonnelAction(leaveOnEmploymentEnd, "journal:first")).toMatchObject({
      replayed: false,
    })
    expect((await shortenEmployment(f)).status).toBe(409)
    expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ON_LEAVE" })
  })

  test("公開writeと既存人事発令を同時に送っても、一方だけを確定する", async () => {
    const f = await fixture()
    await f.initialize()
    const [action, response] = await Promise.all([
      f.applyPersonnelAction(leaveOnEmploymentEnd, "journal:race"),
      shortenEmployment(f),
    ])
    if (action instanceof Error) {
      // 発令が版を確認する前に公開writeが確定した順だけが、不正な遷移になる。
      expect(["personnel_action_stale", "personnel_action_invalid_transition"]).toContain(
        String((action as { code?: unknown }).code),
      )
      expect(response.status).toBe(201)
      await expectOnlyWriteCommitted(f, "journal:race")
    } else {
      expect(action).toMatchObject({ replayed: false })
      expect(response.status).toBe(409)
      expect(await f.access("2027-01-15T00:00:00Z")).toMatchObject({ status: "ON_LEAVE" })
    }
  })

  test("登録した氏名・従業員番号・雇用が名簿と利用資格へ届き、再送で発令を増やさない", async () => {
    const f = await fixture()
    await f.initialize()
    expect(await f.directory("2026-06-01T00:00:00Z")).toMatchObject({
      id: employeeId,
      officialName: "Example Person",
      employeeCode: "RESOURCE-001",
      email: "you@example.com",
      employment: { id: employment.id, status: "ACTIVE" },
    })
    expect(await f.directory("2025-12-31T14:59:59Z")).toBeNull()
    expect(await f.access("2025-12-31T15:00:00Z")).toMatchObject({ status: "ACTIVE" })
    expect((await f.write(employment, 2)).status).toBe(200)
    expect(
      await f.database
        .prepare("SELECT count(*) AS total FROM company_personnel_actions WHERE employee_id = ?1")
        .bind(employeeId)
        .first<number>("total"),
    ).toBe(1)
    expect(
      await f.database
        .prepare(
          "SELECT recorded_by_account_id, source_type FROM company_personnel_actions WHERE employee_id = ?1",
        )
        .bind(employeeId)
        .first<{ recorded_by_account_id: string; source_type: string }>(),
    ).toEqual({ recorded_by_account_id: actor.accountId, source_type: "system" })
  })

  test("未来の休職・復職・退職を先に登録しても、当日の在籍判定を前倒ししない", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      (
        await f.write(
          {
            ...employment,
            revision: 2,
            effectiveFrom: "2026-07-01",
            attributes: { ...employment.attributes, status: "ON_LEAVE" },
          },
          3,
        )
      ).status,
    ).toBe(201)
    expect(
      (await f.write({ ...employment, revision: 3, effectiveFrom: "2026-09-01" }, 4)).status,
    ).toBe(201)
    expect(
      (
        await f.write(
          {
            ...employment,
            revision: 4,
            effectiveFrom: "2026-10-01",
            attributes: { ...employment.attributes, status: "TERMINATED" },
          },
          5,
        )
      ).status,
    ).toBe(201)
    for (const scenario of [
      { now: "2026-06-30T14:59:59Z", status: "ACTIVE" },
      { now: "2026-06-30T15:00:00Z", status: "ON_LEAVE" },
      { now: "2026-08-31T15:00:00Z", status: "ACTIVE" },
      { now: "2026-09-30T14:59:59Z", status: "ACTIVE" },
    ]) {
      expect(await f.directory(scenario.now)).toMatchObject({
        employment: { status: scenario.status },
      })
      expect(await f.access(scenario.now)).toMatchObject({ status: scenario.status })
    }
    expect(await f.directory("2026-09-30T15:00:00Z")).toMatchObject({
      employment: { status: "TERMINATED" },
    })
    expect(await f.access("2026-09-30T15:00:00Z")).toBeNull()
  })

  test("同じ発効日の訂正と取消を読み、古い状態を復活させない", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      (await f.write({ ...employment, revision: 2, effectiveTo: "2026-10-01" }, 3)).status,
    ).toBe(201)
    expect(
      (await f.write({ ...employment, revision: 3, effectiveTo: "2026-11-01" }, 4)).status,
    ).toBe(201)
    expect(await f.access("2026-10-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
    expect((await f.write({ ...employment, revision: 4, state: "void" }, 5)).status).toBe(201)
    expect(await f.access("2026-06-01T00:00:00Z")).toBeNull()
    expect(await f.directory("2026-06-01T00:00:00Z")).toMatchObject({ employment: null })
    expect((await f.write({ ...employee, revision: 2, state: "void" }, 6)).status).toBe(201)
    expect(await f.directory("2026-06-01T00:00:00Z")).toBeNull()
  })

  test("将来の氏名変更と従業員番号は発効日前後で切り替わる", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      (
        await f.write(
          {
            ...person,
            revision: 2,
            effectiveFrom: "2026-10-01",
            attributes: { officialName: "Example Updated" },
          },
          3,
        )
      ).status,
    ).toBe(201)
    expect(
      (
        await f.write(
          {
            ...employee,
            revision: 2,
            effectiveFrom: "2026-10-01",
            attributes: { ...employee.attributes, employeeCode: "RESOURCE-002" },
          },
          4,
        )
      ).status,
    ).toBe(201)
    expect(await f.directory("2026-09-30T14:59:59Z")).toMatchObject({
      officialName: "Example Person",
      employeeCode: "RESOURCE-001",
    })
    expect(await f.directory("2026-09-30T15:00:00Z")).toMatchObject({
      officialName: "Example Updated",
      employeeCode: "RESOURCE-002",
    })
  })

  test("期間保存が失敗したら公開履歴・receipt・業務台帳のすべてを戻し、同じkeyで再試行できる", async () => {
    const f = await fixture()
    expect((await f.write(person, 0)).status).toBe(201)
    expect((await f.write(employee, 1)).status).toBe(201)
    await execSql(
      f.database,
      "CREATE TRIGGER reject_resource_status BEFORE INSERT ON company_employee_status_period_versions BEGIN SELECT RAISE(ABORT, 'injected storage failure'); END;",
    )
    expect((await f.write(employment, 2)).status).toBe(503)
    for (const query of [
      "SELECT resource_id FROM company_resource_heads WHERE resource_type = 'employment'",
      "SELECT resource_id FROM company_resource_revisions WHERE resource_type = 'employment'",
      "SELECT id FROM company_employments",
      "SELECT id FROM company_personnel_actions",
      "SELECT employee_id FROM company_employee_lifecycle_revisions",
      "SELECT command_id FROM company_command_receipts WHERE command_id = 'command:2'",
    ])
      expect(await f.database.prepare(query).first()).toBeNull()
    expect(
      await f.database
        .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
        .bind(organizationId)
        .first<number>("revision"),
    ).toBe(2)
    await execSql(f.database, "DROP TRIGGER reject_resource_status")
    expect((await f.write(employment, 2)).status).toBe(201)
  })

  test("既存の別経路の人事変更を公開resourceの更新で上書きしない", async () => {
    const f = await fixture()
    await f.initialize()
    await f.database
      .prepare(
        "UPDATE company_employee_lifecycle_revisions SET revision = revision + 1 WHERE employee_id = ?1",
      )
      .bind(employeeId)
      .run()
    expect(
      (await f.write({ ...employment, revision: 2, effectiveTo: "2026-10-01" }, 3)).status,
    ).toBe(422)
    expect(
      await f.database
        .prepare("SELECT revision FROM company_resource_heads WHERE resource_id = ?1")
        .bind(employment.id)
        .first<number>("revision"),
    ).toBe(1)
    expect(await f.access("2026-10-15T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
  })

  test("重なる雇用と未対応の雇用区分を拒否し、同じEmployeeの台帳を壊さない", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      (
        await f.write(
          { ...employment, id: deterministicCompanyId("test-employment", "overlap") },
          3,
        )
      ).status,
    ).toBe(422)
    expect(
      (
        await f.write(
          { ...employment, revision: 2, attributes: { employeeId, status: "ACTIVE" } },
          3,
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await f.write(
          {
            ...employment,
            revision: 2,
            attributes: { ...employment.attributes, employmentType: "UNKNOWN" },
          },
          3,
        )
      ).status,
    ).toBe(400)
    expect(await f.access("2026-06-01T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
  })

  test("再入社は別の雇用として受け取り、退職から再入社までの空白を在籍扱いしない", async () => {
    const f = await fixture()
    await f.initialize()
    expect(
      (await f.write({ ...employment, revision: 2, effectiveTo: "2026-04-01" }, 3)).status,
    ).toBe(201)
    expect(
      (
        await f.write(
          {
            ...employment,
            id: deterministicCompanyId("test-employment", "rehire"),
            effectiveFrom: "2026-05-01",
          },
          4,
        )
      ).status,
    ).toBe(201)
    expect(await f.access("2026-04-15T00:00:00Z")).toBeNull()
    expect(await f.directory("2026-04-15T00:00:00Z")).toMatchObject({
      employment: { id: employment.id, status: "TERMINATED" },
    })
    expect(await f.directory("2026-05-01T00:00:00Z")).toMatchObject({
      employment: { id: deterministicCompanyId("test-employment", "rehire"), status: "ACTIVE" },
    })
    const overlapping = {
      ...employment,
      id: deterministicCompanyId("test-employment", "closed-overlap"),
      effectiveFrom: "2026-03-01",
      effectiveTo: "2026-03-15",
    }
    expect((await f.write(overlapping, 5)).status).toBe(422)
    expect(
      await f.database
        .prepare("SELECT id FROM company_employments WHERE id = ?1")
        .bind(overlapping.id)
        .first(),
    ).toBeNull()
    expect(
      (await f.correctStart("2026-02-01", 5, "correct:prior-employment-start", 2)).status,
    ).toBe(201)
    expect(await f.access("2026-01-15T00:00:00Z")).toBeNull()
    expect(await f.directory("2026-03-01T00:00:00Z")).toMatchObject({
      employment: { id: employment.id, status: "ACTIVE" },
    })
    expect(await f.directory("2026-05-01T00:00:00Z")).toMatchObject({
      employment: { id: deterministicCompanyId("test-employment", "rehire"), status: "ACTIVE" },
    })
  })

  test("PersonとEmployeeの有効期間に空白がある場合は雇用期間を作らない", async () => {
    const f = await fixture()
    expect((await f.write({ ...person, effectiveTo: "2026-03-01" }, 0)).status).toBe(201)
    expect((await f.write({ ...person, revision: 2, effectiveFrom: "2026-05-01" }, 1)).status).toBe(
      201,
    )
    expect((await f.write(employee, 2)).status).toBe(422)
    expect(
      await f.database
        .prepare("SELECT id FROM company_employees WHERE id = ?1")
        .bind(employeeId)
        .first(),
    ).toBeNull()
    expect((await f.write({ ...employee, effectiveFrom: "2026-05-01" }, 2)).status).toBe(201)
    expect((await f.write(employment, 3)).status).toBe(422)
    expect((await f.write({ ...employment, effectiveFrom: "2026-05-01" }, 3)).status).toBe(201)
  })

  test("参照される人の有効期間を縮めて在籍中の従業員を消せない", async () => {
    const f = await fixture()
    await f.initialize()
    expect((await f.write({ ...person, revision: 2, effectiveTo: "2026-04-01" }, 3)).status).toBe(
      422,
    )
    expect(await f.directory("2026-06-01T00:00:00Z")).toMatchObject({
      officialName: "Example Person",
      employment: { status: "ACTIVE" },
    })
    expect(
      await f.database
        .prepare("SELECT revision FROM company_resource_heads WHERE resource_id = ?1")
        .bind(person.id)
        .first<number>("revision"),
    ).toBe(1)
  })
})
