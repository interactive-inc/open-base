import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { expect, test } from "bun:test"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

const directory = new URL("../../../db/migrations/", import.meta.url)
const migrationSql = readFileSync(
  new URL("0018_company_employment_authority_effective_revisions.sql", directory),
  "utf8",
)
const migration = readMigrationFiles({ migrationsFolder: directory.pathname }).find(
  (entry) => entry.hash === createHash("sha256").update(migrationSql).digest("hex"),
)
const priorView = splitSqlStatements(
  readFileSync(new URL("0001_foundation.sql", directory), "utf8"),
).findLast((statement) =>
  statement.includes("CREATE VIEW company_employment_authority_violations AS"),
)
if (migration === undefined || priorView === undefined)
  throw new Error("migration definition missing")
const upgrade = migration.sql
const schema = `
CREATE TABLE company_resource_revisions (
  organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER,
  effective_from TEXT, effective_to TEXT, state TEXT, attributes_json TEXT, corrects_revision INTEGER);
CREATE TABLE company_workforce_resource_bindings (
  organization_id TEXT, resource_type TEXT, resource_id TEXT, employee_id TEXT);
CREATE TABLE company_employment_period_versions (
  employee_id TEXT, period_id TEXT, starts_on TEXT, ends_on TEXT, is_void INTEGER, revision INTEGER);
CREATE TABLE company_organization_assignment_coverage (
  employee_id TEXT, employment_id TEXT, organization_unit_id TEXT, starts_on TEXT, ends_on TEXT);
INSERT INTO company_workforce_resource_bindings VALUES ('organization', 'employee', 'worker', 'worker');
INSERT INTO company_employment_period_versions VALUES ('worker', 'employment', '2030-03-01', NULL, 0, 1);
INSERT INTO company_resource_revisions VALUES
  ('organization', 'office-assignment', 'appointment', 1, '2030-02-01', NULL, 'active', '{"employeeId":"worker","employmentId":"employment"}', NULL),
  ('organization', 'office-assignment', 'appointment', 2, '2030-03-01', NULL, 'active', '{"employeeId":"worker","employmentId":"employment"}', 1);
${priorView}`

test("任命の前進移行は原本を変えず訂正前の期間を除外する", async () => {
  const database = await createLocalD1Database({ schema })
  const rows = async () =>
    (await database.prepare("SELECT * FROM company_resource_revisions ORDER BY revision").all())
      .results
  const violations = async () =>
    (await database.prepare("SELECT * FROM company_employment_authority_violations").all()).results
  const before = await rows()
  expect(await violations()).toHaveLength(1)
  await database.batch(upgrade.map((statement) => database.prepare(statement)))
  expect(await rows()).toEqual(before)
  expect(await violations()).toEqual([])
  await database
    .prepare(`INSERT INTO company_resource_revisions VALUES
    ('organization', 'office-assignment', 'invalid', 1, '2030-02-01', NULL, 'active', '{"employeeId":"worker","employmentId":"employment"}', NULL)`)
    .run()
  expect(await violations()).toHaveLength(1)
})

test("移行の途中で失敗した場合は以前の検査を残す", async () => {
  const database = await createLocalD1Database({ schema })
  const definition = async () =>
    database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE name = 'company_employment_authority_violations'",
      )
      .first<string>("sql")
  const before = await definition()
  const failure = await database
    .batch([
      ...upgrade.map((statement) => database.prepare(statement)),
      database.prepare("SELECT json_extract('{}', 'injected_failure')"),
    ])
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(Error)
  expect(await definition()).toBe(before)
  expect(
    (await database.prepare("SELECT * FROM company_employment_authority_violations").all()).results,
  ).toHaveLength(1)
})
