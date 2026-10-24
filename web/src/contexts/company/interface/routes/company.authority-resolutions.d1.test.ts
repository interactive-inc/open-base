import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { POST } from "@/contexts/company/interface/routes/company.authority-resolutions"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import type { SystemDatabase } from "@system/configuration/system-context"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { readFileSync } from "node:fs"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const systemSql = readFileSync(
  new URL("../../../system/infrastructure/schema/system-core.sql", import.meta.url),
  "utf8",
)
const companySql = readFileSync(
  new URL("../../infrastructure/schema/company.sql", import.meta.url),
  "utf8",
)
const principalSql = ["system-integration.sql", "system-principal.sql"]
  .map((name) =>
    readFileSync(new URL(`../../../system/infrastructure/schema/${name}`, import.meta.url), "utf8"),
  )
  .join("\n")
const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID
const asOf = restoreCalendarDate("2026-01-01")
const accountIds = {
  active: "f916f832-e97a-448a-a4c4-399ca2b9d39d",
  suspended: "7725d648-f2f9-4559-83eb-ac1326a169c0",
} as const
const employeeIds = {
  active: "51102976-22e7-44e7-bb93-c33967b91fa6",
  suspended: deterministicCompanyId("employee", "suspended"),
} as const
const responsibilityId = deterministicCompanyId("responsibility", "approve")

describe("Company authority resolution HTTP", () => {
  test("候補取得と期間照合の間の変更は409で拒否し、同じ照会を再試行できる", async () => {
    const database = await createLocalD1Database({
      schema: `${systemSql}\n${principalSql}\n${companySql}`,
    })
    await seed(database)
    const pending = new Set(["change"])
    const concurrent = new Proxy(database, {
      get(target, property) {
        if (property === "batch")
          return async (statements: D1PreparedStatement[]) => {
            const rows = await target.batch(statements)
            if (pending.delete("change")) {
              const change = CompanyResourceChangeEntity.create({
                commandId: "command:concurrent-authority",
                expectedRevision: 1,
                actorAccountId: "f916f832-e97a-448a-a4c4-399ca2b9d39d",
                reason: "Confirmed responsibility correction",
                recordedAt: 2,
                resources: [
                  {
                    organizationId,
                    type: "responsibility",
                    id: responsibilityId,
                    revision: 2,
                    state: "active",
                    effectiveFrom: asOf,
                    effectiveTo: null,
                    attributes: { code: "APPROVE", officialName: "Corrected approval" },
                  },
                ],
              })
              if (change instanceof Error) throw change
              expect((await new D1CompanyResourceRepository({ database }).write(change)).kind).toBe(
                "applied",
              )
            }
            return rows
          }
        const value = Reflect.get(target, property)
        return typeof value === "function" ? value.bind(target) : value
      },
    })
    const app = createApp()
    const request = () =>
      app.request(
        "/company/authority-resolutions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-company-organization-id": organizationId,
          },
          body: JSON.stringify({
            as_of: asOf,
            subject_employee_id: null,
            criteria: [{ responsibility_code: "APPROVE", scope: null }],
          }),
        },
        { DB: concurrent, NOW: "2026-01-01T00:00:00Z" },
      )
    const rejected = await request()
    expect(rejected.status).toBe(409)
    expect(await rejected.json()).toMatchObject({ code: "company_authority_snapshot_changed" })
    const retried = await request()
    expect(retried.status).toBe(200)
    expect(await retried.json()).toMatchObject({
      snapshot: { organizationRevision: 2 },
      candidates: [{ accountId: "f916f832-e97a-448a-a4c4-399ca2b9d39d" }],
    })
  })

  test("公開Account対応が期間台帳に接続していなければ承認候補を返さない", async () => {
    const database = await createLocalD1Database({
      schema: `${systemSql}\n${principalSql}\n${companySql}`,
    })
    await seed(database)
    await execSql(database, "DROP TRIGGER company_account_employee_resource_bindings_delete_guard")
    await execSql(
      database,
      "DELETE FROM company_account_employee_resource_bindings WHERE account_id = 'f916f832-e97a-448a-a4c4-399ca2b9d39d'",
    )
    const response = await createApp().request(
      "/company/authority-resolutions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-organization-id": organizationId,
        },
        body: JSON.stringify({
          as_of: asOf,
          subject_employee_id: null,
          criteria: [{ responsibility_code: "APPROVE", scope: null }],
        }),
      },
      { DB: database, NOW: "2026-01-01T00:00:00Z" },
    )
    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ code: "company_read_unavailable" })
  })

  test.each([
    { kind: "service", accountCreatedAt: 1, principalCreatedAt: 1 },
    { kind: "agent", accountCreatedAt: 1, principalCreatedAt: 1 },
    { kind: "missing", accountCreatedAt: 1, principalCreatedAt: 1 },
    { kind: "human", accountCreatedAt: 1, principalCreatedAt: 4102444800000 },
    { kind: "human", accountCreatedAt: 4102444800000, principalCreatedAt: 4102444800000 },
  ])("人間でない主体・未登録・判定後に作られる主体を承認候補へ含めない: %s", async (principal) => {
    const database = await createLocalD1Database({
      schema: `${systemSql}\n${principalSql}\n${companySql}`,
    })
    await seed(database, principal)
    const response = await createApp().request(
      "/company/authority-resolutions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-company-organization-id": organizationId,
        },
        body: JSON.stringify({
          as_of: asOf,
          subject_employee_id: null,
          criteria: [{ responsibility_code: "APPROVE", scope: null }],
        }),
      },
      { DB: database, NOW: "2026-01-01T00:00:00Z" },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ candidates: [] })
  })

  test("Company責務をliveなSystem Accountへ解決し、DB障害は候補なしへ畳まない", async () => {
    const database = await createLocalD1Database({
      schema: `${systemSql}\n${principalSql}\n${companySql}`,
    })
    await seed(database)
    const app = createApp()
    let requestDatabase = database
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: requestDatabase })
    const client = hc<typeof app>("http://company.test", {
      fetch: request,
    })

    const resolved = await client.company["authority-resolutions"].$post({
      header: { "x-company-organization-id": organizationId },
      json: {
        as_of: asOf,
        subject_employee_id: null,
        criteria: [{ responsibility_code: "APPROVE", scope: null }],
      },
    })
    expect({ status: resolved.status, body: await resolved.json() }).toMatchObject({
      status: 200,
      body: {
        snapshot: { organizationRevision: 1 },
        candidates: [
          {
            employeeId: "51102976-22e7-44e7-bb93-c33967b91fa6",
            accountId: "f916f832-e97a-448a-a4c4-399ca2b9d39d",
          },
        ],
      },
    })

    // ローカルD1は外部キーを止められず表を消せないため、System Accountの読取だけを失敗させる。
    requestDatabase = withUnavailableTable(database, "system_accounts")
    const unavailable = await client.company["authority-resolutions"].$post({
      header: { "x-company-organization-id": organizationId },
      json: {
        as_of: asOf,
        subject_employee_id: null,
        criteria: [{ responsibility_code: "APPROVE", scope: null }],
      },
    })
    expect(Number(unavailable.status)).toBe(503)
    expect(await unavailable.json()).toMatchObject({ code: "company_read_unavailable" })
  })
})

function createApp() {
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "f916f832-e97a-448a-a4c4-399ca2b9d39d",
        employeeId: "51102976-22e7-44e7-bb93-c33967b91fa6",
        organizationIds: [organizationId],
        capabilities: ["company:read"],
      }),
    )
    context.set("database", {} as SystemDatabase)
    context.set("auditContext", {
      requestId: "authority-test",
      clientName: "system",
      clientIp: null,
      externalRequestId: null,
    })
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code, detail: error.detail }, error.status)
  })
  return app.post("/company/authority-resolutions", ...POST)
}

async function seed(
  database: D1Database,
  principal = { kind: "human", accountCreatedAt: 1, principalCreatedAt: 1 },
): Promise<void> {
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('f916f832-e97a-448a-a4c4-399ca2b9d39d', 'active', 0, ${principal.accountCreatedAt}, ${principal.accountCreatedAt}),
            ('7725d648-f2f9-4559-83eb-ac1326a169c0', 'suspended', 0, 1, 1);
     INSERT INTO company_organizations
       (id, revision, name, representative_name, created_at, updated_at)
     VALUES ('${organizationId}', 0, '', '', 1, 1);`,
  )
  if (principal.kind !== "missing")
    await database
      .prepare(`INSERT INTO system_principals (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
      VALUES ('6fb1c67b-f36a-44c3-89e4-584eefce94ac', 'f916f832-e97a-448a-a4c4-399ca2b9d39d', ?, 'Example Human', NULL, 1, ?, ?)`)
      .bind(principal.kind, principal.principalCreatedAt, principal.principalCreatedAt)
      .run()
  const base = {
    organizationId,
    revision: 1,
    state: "active" as const,
    effectiveFrom: asOf,
    effectiveTo: null,
  }
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      type: "responsibility",
      id: responsibilityId,
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
  ]
  for (const state of ["active", "suspended"] as const) {
    resources.push(
      {
        ...base,
        type: "person",
        id: deterministicCompanyId("person", state),
        attributes: { officialName: `Example ${state}` },
      },
      {
        ...base,
        type: "employee",
        id: employeeIds[state],
        attributes: {
          personId: deterministicCompanyId("person", state),
          employeeCode: state.toUpperCase(),
        },
      },
      {
        ...base,
        type: "employment",
        id: deterministicCompanyId("employment", state),
        attributes: {
          employeeId: employeeIds[state],
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        },
      },
      {
        ...base,
        type: "account-employee-link",
        id: deterministicCompanyId("account-link", state),
        attributes: {
          accountId: accountIds[state],
          employeeId: employeeIds[state],
        },
      },
      {
        ...base,
        type: "responsibility-assignment",
        id: deterministicCompanyId("responsibility-assignment", state),
        attributes: {
          responsibilityId,
          holderType: "employee",
          holderId: employeeIds[state],
          authorityScopeId: null,
          delegationAllowed: false,
        },
      },
    )
  }
  const change = CompanyResourceChangeEntity.create({
    commandId: "command:authority-seed",
    expectedRevision: 0,
    actorAccountId: "f916f832-e97a-448a-a4c4-399ca2b9d39d",
    reason: "authority test seed",
    recordedAt: 1,
    resources,
  })
  if (change instanceof Error) throw change
  const written = await new D1CompanyResourceRepository({ database }).write(change)
  if (written.kind !== "applied") throw new Error(`failed to seed: ${written.kind}`)
}

/** 指定した表を読む文だけを、DB障害として失敗させる。 */
function withUnavailableTable(database: D1Database, table: string): D1Database {
  const unavailable = (): Promise<never> =>
    Promise.reject(new Error(`D1_ERROR: no such table: ${table}: SQLITE_ERROR`))
  const failing = (): D1PreparedStatement => {
    const statement = {
      bind: () => statement,
      first: unavailable,
      all: unavailable,
      run: unavailable,
      raw: unavailable,
    }
    return statement as unknown as D1PreparedStatement
  }
  return new Proxy(database, {
    get(target, property) {
      if (property === "prepare")
        return (sql: string) => (sql.includes(table) ? failing() : target.prepare(sql))
      const value: unknown = Reflect.get(target, property, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
