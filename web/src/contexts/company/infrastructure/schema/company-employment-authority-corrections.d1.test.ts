import { readFileSync } from "node:fs"
import { expect, test } from "bun:test"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

const statements = splitSqlStatements(
  readFileSync(new URL("./company.sql", import.meta.url), "utf8"),
)
const view = statements.findLast((statement) =>
  statement.includes("CREATE VIEW company_employment_authority_violations AS"),
)
if (view === undefined) throw new Error("employment authority view missing")

const schema = `
CREATE TABLE company_resource_revisions (
  organization_id TEXT, resource_type TEXT, resource_id TEXT, revision INTEGER,
  effective_from TEXT, effective_to TEXT, state TEXT, attributes_json TEXT, corrects_revision INTEGER
);
CREATE TABLE company_workforce_resource_bindings (
  organization_id TEXT, resource_type TEXT, resource_id TEXT, employee_id TEXT
);
CREATE TABLE company_employment_period_versions (
  employee_id TEXT, period_id TEXT, starts_on TEXT, ends_on TEXT, is_void INTEGER, revision INTEGER
);
CREATE TABLE company_organization_assignment_coverage (
  employee_id TEXT, employment_id TEXT, organization_unit_id TEXT, starts_on TEXT, ends_on TEXT
);
INSERT INTO company_workforce_resource_bindings VALUES ('organization', 'employee', 'worker', 'worker');
INSERT INTO company_employment_period_versions VALUES ('worker', 'employment', '2030-03-01', '2030-04-01', 0, 1);
INSERT INTO company_organization_assignment_coverage VALUES ('worker', 'employment', 'unit', '2030-03-01', '2030-04-01');
${view}`

for (const resourceType of [
  "office-assignment",
  "organizational-authority",
  "responsibility-assignment",
  "collective-body-membership",
]) {
  test(`${resourceType}: 訂正前の期間を除き、本当の雇用期間外と通常の終了を判定する`, async () => {
    const database = await createLocalD1Database({ schema })
    const attributes = JSON.stringify({
      employeeId: "worker",
      holderId: "worker",
      holderType: "employee",
      employmentId: "employment",
      scopeType: "authority-scope",
      scopeId: "scope",
    })
    const add = (revision: number, from: string, state: string, corrects: number | null) =>
      database
        .prepare(`INSERT INTO company_resource_revisions VALUES
        ('organization', ?1, 'appointment', ?2, ?3, NULL, ?4, ?5, ?6)`)
        .bind(resourceType, revision, from, state, attributes, corrects)
        .run()
    const violations = async () =>
      (await database.prepare("SELECT * FROM company_employment_authority_violations").all())
        .results

    await add(1, "2030-02-01", "active", null)
    expect(await violations()).toHaveLength(1)
    await add(2, "2030-03-01", "active", 1)
    await add(3, "2030-04-01", "void", null)
    expect(await violations()).toEqual([])

    // 訂正の取消で終了版が無効になると、任命は雇用終了を超えるため拒否する。
    await add(4, "2030-04-01", "void", 3)
    expect(await violations()).toHaveLength(1)
    await add(5, "2030-04-01", "void", null)
    expect(await violations()).toEqual([])
  })
}
