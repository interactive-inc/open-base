import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import {
  CompanyActorValue,
  type CompanyCapability,
} from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import { POST as ORGANIZATION_POST } from "@/contexts/company/interface/routes/company.organization-changes"
import { POST as ACCOUNT_LINK_POST } from "@/contexts/company/interface/routes/company.account-employee-links"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const linkedAccountId = "f3b9abc8-e975-4769-98eb-ffca70786ee5"
const organizationManagerPermissions: CompanyPermissionKey[] = [
  "org:write",
  "master:org:write",
  "master:grade:write",
  "master:position:write",
  "employee:write",
  "employee:write:basic",
  "employee:write:attributes",
]

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
  await database
    .prepare(
      `INSERT INTO company_organizations
         (id, revision, name, representative_name, created_at, updated_at)
       VALUES (?, 0, '', '', 0, 0)`,
    )
    .bind(COMPANY_DEFAULT_ORGANIZATION_ID)
    .run()
  await database
    .prepare(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?, 'active', 0, 0, 0)",
    )
    .bind(linkedAccountId)
    .run()
  const state: { capabilities: CompanyCapability[]; permissions: CompanyPermissionKey[] } = {
    capabilities: ["company:write"],
    permissions: [],
  }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set(
      "companyActor",
      CompanyActorValue.restore({
        accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
        employeeId: null,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        capabilities: state.capabilities,
        permissions: state.permissions,
      }),
    )
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  app.post("/organization-changes", ...ORGANIZATION_POST)
  app.post("/account-employee-links", ...ACCOUNT_LINK_POST)
  const post = (path: string, commandId: string, revision: number, resources: unknown[]) =>
    app.request(
      path,
      {
        method: "POST",
        headers: {
          "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
          "content-type": "application/json",
          "if-match": String(revision),
          "idempotency-key": commandId,
        },
        body: JSON.stringify({ reason: "Confirmed change", resources }),
      },
      { DB: database },
    )
  const countRevisions = async () =>
    (
      await database
        .prepare("SELECT COUNT(*) AS count FROM company_resource_revisions")
        .first<{ count: number }>()
    )?.count
  return { state, post, countRevisions }
}

const base = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  revision: 1,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
} as const
const organizationUnit = {
  ...base,
  type: "organization-unit",
  id: "0190005f-0000-7000-8000-0e0100000001",
  attributes: {
    organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
    code: "ROOT",
    officialName: "Company",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
  },
}
const person = {
  ...base,
  type: "person",
  id: "7d2c1b0a-3e4f-4a5b-8c6d-1e2f3a4b5c6d",
  attributes: { officialName: "Person" },
}
const employee = {
  ...base,
  type: "employee",
  id: "4d1c9a7e-2b3f-4e5a-8c6d-7e8f9a0b1c2d",
  attributes: { personId: person.id, employeeCode: "E001" },
}
const employment = {
  ...base,
  type: "employment",
  id: "6e2d0b8f-3c4a-4f6b-9d7e-8f9a0b1c2d3e",
  attributes: { employeeId: employee.id, status: "ACTIVE", employmentType: "FULL_TIME" },
}
const gradeAssignment = {
  ...base,
  type: "grade-assignment",
  id: "8a3e1c9f-4d5b-4c7a-8e9f-0a1b2c3d4e5f",
  attributes: {
    employeeId: employee.id,
    employmentId: employment.id,
    gradeId: "9b4f2d0a-5e6c-4d8b-9f0a-1b2c3d4e5f60",
  },
}
const accountLink = {
  ...base,
  type: "account-employee-link",
  id: "0c5a3e1b-6f7d-4e9c-8a1b-2c3d4e5f6071",
  attributes: { accountId: linkedAccountId, employeeId: employee.id },
}

test("組織変更はcompany:writeに加えて資源種別ごとの個別権限を要求する", async () => {
  const f = await fixture()

  f.state.permissions = []
  expect((await f.post("/organization-changes", "unit:none", 0, [organizationUnit])).status).toBe(
    403,
  )
  f.state.permissions = ["employee:write", "master:grade:write", "employee:write:attributes"]
  expect((await f.post("/organization-changes", "unit:other", 0, [organizationUnit])).status).toBe(
    403,
  )
  f.state.permissions = ["org:write", "master:grade:write"]
  expect(
    (
      await f.post("/organization-changes", "grade-assignment:definition-only", 0, [
        gradeAssignment,
      ])
    ).status,
  ).toBe(403)
  expect(
    (await f.post("/organization-changes", "workforce:org-only", 0, [person, employee, employment]))
      .status,
  ).toBe(403)
  f.state.capabilities = []
  f.state.permissions = organizationManagerPermissions
  expect(
    (await f.post("/organization-changes", "unit:no-capability", 0, [organizationUnit])).status,
  ).toBe(403)
  expect(await f.countRevisions()).toBe(0)

  f.state.capabilities = ["company:write"]
  f.state.permissions = ["org:write"]
  expect((await f.post("/organization-changes", "unit:create", 0, [organizationUnit])).status).toBe(
    201,
  )
  f.state.permissions = ["employee:write"]
  expect(
    (await f.post("/organization-changes", "workforce:create", 1, [person, employee, employment]))
      .status,
  ).toBe(201)
})

test("アカウントと従業員の紐付けはaccount_link:writeを要求する", async () => {
  const f = await fixture()
  f.state.permissions = organizationManagerPermissions
  expect(
    (await f.post("/organization-changes", "workforce:create", 0, [person, employee, employment]))
      .status,
  ).toBe(201)
  const before = await f.countRevisions()

  expect((await f.post("/account-employee-links", "link:hr", 1, [accountLink])).status).toBe(403)
  f.state.capabilities = []
  f.state.permissions = ["account_link:write"]
  expect(
    (await f.post("/account-employee-links", "link:no-capability", 1, [accountLink])).status,
  ).toBe(403)
  f.state.capabilities = ["company:write"]
  f.state.permissions = [...organizationManagerPermissions, "account_link:write"]
  expect(
    (await f.post("/organization-changes", "link:via-organization-change", 1, [accountLink]))
      .status,
  ).toBe(400)
  expect(await f.countRevisions()).toBe(before)

  expect((await f.post("/account-employee-links", "link:create", 1, [accountLink])).status).toBe(
    201,
  )
  expect(await f.countRevisions()).toBe((before ?? 0) + 1)
})
