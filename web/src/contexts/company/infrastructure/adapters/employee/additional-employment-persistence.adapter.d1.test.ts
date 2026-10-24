import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { AdditionalEmploymentPersistenceAdapter } from "./additional-employment-persistence.adapter"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

// 両製品の全migrationを適用するfixtureを使うため、各caseの上限は20秒とする。
const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((path) => path.endsWith(".sql"))
  .sort()
  .map((path) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, path), "utf8"))
  .join("\n")
const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID
const person: CompanyResourceProps = {
  organizationId,
  type: "person",
  id: "person:one",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: null,
  attributes: { officialName: "Confirmed Person", email: "you@example.com", phone: "000-0000" },
}
const employee: CompanyResourceProps = {
  ...person,
  type: "employee",
  id: "9e174baf-3240-4253-9cba-16bc3e431cca",
  attributes: { personId: person.id, employeeCode: "E001" },
}
const employment: CompanyResourceProps = {
  ...person,
  type: "employment",
  id: "7c2e4b1a-5d3f-4e6a-9b8c-1d2e3f4a5b6c",
  effectiveTo: restoreCalendarDate("2026-08-01"),
  attributes: { employeeId: employee.id, employmentType: "FULL_TIME", status: "ACTIVE" },
}

async function write(
  database: D1Database,
  resources: ReadonlyArray<CompanyResourceProps>,
  revision = 0,
) {
  const change = CompanyResourceChangeEntity.create({
    resources,
    expectedRevision: revision,
    commandId: `setup:${revision}`,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirmed company facts",
    recordedAt: Date.parse("2026-09-08T00:00:00Z"),
  })
  if (change instanceof Error) throw change
  const result = await new D1CompanyResourceRepository({ database }).write(change)
  if (result.kind !== "applied") throw new Error(JSON.stringify(result))
}
async function fixture() {
  const database = await createLocalD1Database({ schema: schemaSql })
  await write(database, [person, employee, employment])
  return database
}
function input(effectiveOn = "2026-09-01") {
  return {
    employeeId: employee.id,
    employmentId: "f9fa16ba-b4c2-4359-af81-c3e56ab539c0",
    employmentType: "PART_TIME" as const,
    status: "ON_LEAVE" as const,
    effectiveOn: restoreCalendarDate(effectiveOn),
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    occurredAt: new Date("2026-09-08T00:00:00Z"),
    operationId: "0f00974f-d2d8-4dad-987b-4bc9dd09bca8",
    reason: "Confirmed new contract",
  }
}
async function prepare(database: D1Database, effectiveOn = "2026-09-01") {
  const result = await new AdditionalEmploymentPersistenceAdapter(database).prepareMany(
    [input(effectiveOn)],
    1,
  )
  if (result instanceof Error) throw result
  return [...result]
}
async function counts(database: D1Database) {
  const tables = [
    "company_employments",
    "company_resource_revisions",
    "company_command_receipts",
    "company_personnel_actions",
    "company_employment_period_versions",
    "company_employee_status_period_versions",
  ]
  return Promise.all(
    tables.map((table) =>
      database.prepare(`SELECT count(*) AS count FROM ${table}`).first<number>("count"),
    ),
  )
}

async function rejects(operation: Promise<unknown>): Promise<void> {
  const failure = await operation.then(
    () => null,
    (cause: unknown) => cause,
  )
  expect(failure).toBeInstanceOf(Error)
}

test("既存の人物・従業員・旧雇用を保ち、追加雇用の公開履歴と期間を確定する", async () => {
  const database = await fixture()
  await database.batch(await prepare(database))
  expect(
    await database
      .prepare("SELECT official_name, employee_code, email, phone FROM company_employees")
      .first<Record<string, unknown>>(),
  ).toEqual({
    official_name: "Confirmed Person",
    employee_code: "E001",
    email: "you@example.com",
    phone: "000-0000",
  })
  expect(
    await database
      .prepare(
        "SELECT contract_name, employment_type, hire_date, status FROM company_employments WHERE id = 'f9fa16ba-b4c2-4359-af81-c3e56ab539c0'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({
    contract_name: "Confirmed Person",
    employment_type: "PART_TIME",
    hire_date: "2026-09-01",
    status: "ON_LEAVE",
  })
  expect(
    await database
      .prepare(
        "SELECT termination_date FROM company_employments WHERE id = '7c2e4b1a-5d3f-4e6a-9b8c-1d2e3f4a5b6c'",
      )
      .first<string>("termination_date"),
  ).toBe("2026-07-31")
  expect(
    await database
      .prepare(
        "SELECT starts_on, ends_on, status FROM company_employee_status_period_versions WHERE employment_period_id = 'f9fa16ba-b4c2-4359-af81-c3e56ab539c0'",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({ starts_on: "2026-09-01", ends_on: null, status: "leave" })
  for (const [date, ids] of [
    ["2026-08-15", []],
    ["2026-09-01", ["f9fa16ba-b4c2-4359-af81-c3e56ab539c0"]],
  ] as const) {
    const result = await new D1CompanyResourceRepository({ database }).findMany({
      organizationId,
      types: ["employment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!result.ok) throw result.cause
    expect(result.resources.map((resource) => resource.id)).toEqual([...ids])
  }
  expect(
    await database
      .prepare(
        "SELECT recorded_by_account_id, kind FROM company_personnel_actions ORDER BY rowid DESC LIMIT 1",
      )
      .first<Record<string, unknown>>(),
  ).toEqual({
    recorded_by_account_id: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    kind: "employment_revised",
  })
  const before = await counts(database)
  await rejects(prepare(database))
  expect(await counts(database)).toEqual(before)
}, 20_000)

test("過去雇用と重複する追加は公開履歴も期間も保存しない", async () => {
  const database = await fixture()
  const before = await counts(database)
  await rejects(database.batch(await prepare(database, "2026-07-31")))
  expect(await counts(database)).toEqual(before)
}, 20_000)

test("未接続の従業員を雇用追加で暗黙に移行しない", async () => {
  const database = await createLocalD1Database({ schema: schemaSql })
  await database
    .prepare(
      "INSERT INTO company_employees (id, official_name, created_at, updated_at) VALUES ('9e174baf-3240-4253-9cba-16bc3e431cca', 'Confirmed Person', 0, 0)",
    )
    .run()
  expect(
    await new AdditionalEmploymentPersistenceAdapter(database).prepareMany([input()], 0),
  ).toBeInstanceOf(Error)
  expect(await counts(database)).toEqual([0, 0, 0, 0, 0, 0])
}, 20_000)

test("準備後の会社版変更で追加を取り消し、先に確定した人物訂正を保つ", async () => {
  const database = await fixture()
  const prepared = await prepare(database)
  await write(
    database,
    [{ ...person, revision: 2, attributes: { ...person.attributes, phone: "111-1111" } }],
    1,
  )
  const before = await counts(database)
  await rejects(database.batch(prepared))
  expect(await counts(database)).toEqual(before)
  expect(await database.prepare("SELECT phone FROM company_employees").first<string>("phone")).toBe(
    "111-1111",
  )
}, 20_000)

test("期間保存の失敗は全履歴を戻し、同じ雇用IDと操作IDでやり直せる", async () => {
  const database = await fixture()
  const before = await counts(database)
  await execSql(
    database,
    "CREATE TRIGGER reject_additional_status BEFORE INSERT ON company_employee_status_period_versions BEGIN SELECT RAISE(ABORT, 'injected status failure'); END;",
  )
  await rejects(database.batch(await prepare(database)))
  expect(await counts(database)).toEqual(before)
  await execSql(database, "DROP TRIGGER reject_additional_status")
  await database.batch(await prepare(database))
  expect(await counts(database)).toEqual([2, 4, 2, 2, 2, 2])
}, 20_000)
