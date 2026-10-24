import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { InitialEmploymentActionAdapter } from "@/contexts/company/infrastructure/adapters/employee/initial-employment-action.adapter"
import { PublishedInitialWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/employee/published-initial-workforce.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schemaSql = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
  .join("\n")
const item = {
  employeeId: restoreWorkforceId("employee", "8d0f7b9e-3c4a-4f1b-9e2d-6a5b4c3d2e10"),
  employmentId: restoreWorkforceId("employment", "3e7a1c5d-9b2f-4d6e-8a1c-0f9e8d7c6b52"),
  officialName: "Example Person",
  employeeCode: "one",
  email: "you@example.com",
  phone: null,
  employmentType: "PART_TIME" as const,
  status: "leave" as const,
  effectiveOn: restoreCalendarDate("2026-09-01"),
  occurredAt: new Date("2026-08-01T00:00:00Z"),
  actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
  operationId: "83db9b6a-0a4a-4d6f-8188-437800b466a1",
  reason: "Confirmed new employment",
  lifecycleRevision: 0,
}

async function rows(database: D1Database) {
  const read = async (sql: string) => (await database.prepare(sql).all()).results
  return {
    employees: await read(
      "SELECT id, official_name, employee_code, email, phone FROM company_employees",
    ),
    employments: await read(
      "SELECT id, employee_id, contract_name, employment_type, hire_date, status, termination_date FROM company_employments",
    ),
    periods: await read(
      "SELECT period_id, revision, starts_on, ends_on, is_void, recorded_by_action_id FROM company_employment_period_versions",
    ),
    statuses: await read(
      "SELECT revision, status, starts_on, ends_on, is_void, recorded_by_action_id FROM company_employee_status_period_versions",
    ),
    actions: await read("SELECT * FROM company_personnel_actions"),
    lifecycle: await read("SELECT employee_id, revision FROM company_employee_lifecycle_revisions"),
    bindings: await read(
      "SELECT resource_type, resource_id, resource_revision, lifecycle_revision, last_action_id FROM company_workforce_resource_bindings ORDER BY resource_type",
    ),
    resources: await read(
      "SELECT resource_type, resource_id, revision, state, effective_from, attributes_json FROM company_resource_revisions ORDER BY resource_type",
    ),
    organization: await read("SELECT revision FROM company_organizations"),
  }
}

async function published() {
  const database = await createLocalD1Database({ schema: schemaSql })
  const action = await new InitialEmploymentActionAdapter(database).prepare(item)
  if (action instanceof Error) throw action
  const workforce = await new PublishedInitialWorkforceAdapter(database).prepare({
    ...item,
    commandId: `initial-workforce:${item.operationId}`,
    recordedAt: item.occurredAt.getTime(),
    expectedOrganizationRevision: 0,
    actionId: action.actionId,
    businessDate: "2026-08-01",
    lifecycleRevision: 0,
  })
  if (workforce instanceof Error) throw workforce
  await database.batch([
    ...workforce.identityStatements,
    ...action.statements,
    ...workforce.employmentStatements,
    ...workforce.commitStatements,
  ])
  return { database, rows: await rows(database) }
}

// 置き換え前の、表を先に書く経路と同じ行を書くことを確かめてから、その行を固定した。
test("公開 resource を正本とする初回雇用が書く行を固定する", async () => {
  expect((await published()).rows).toMatchSnapshot()
}, 30_000)

test("同じ従業員の 2 回目の初回雇用は、発令を重ねず全体を中断する", async () => {
  const { database, rows: first } = await published()
  const action = await new InitialEmploymentActionAdapter(database).prepare(item)
  if (action instanceof Error) throw action

  await expect(database.batch([...action.statements])).rejects.toThrow()
  expect(await rows(database)).toEqual(first)
}, 30_000)
