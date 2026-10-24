import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { prepareHistoricalCompanyResourceRevisionFixture } from "@/contexts/company/test/historical-company-resource-revision.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { alignHistoricalMigrationSql } from "@/contexts/company/test/align-historical-organization-identity.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

describe("所属移行の上長対応を追加するmigration", () => {
  test("既存発令の上長対応とrowidを保持し、更新禁止と通常の上長変更が移行後も働く", async () => {
    const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort()
    const first = files.find((file) =>
      file.endsWith("_record_company_assignment_resource_adoptions.sql"),
    )
    if (first === undefined) throw new Error("missing assignment adoption migration")
    // このfixtureでは初期化の仮期間ではなく、移行前に確認済みだった組織を再現する。
    // 旧schemaへ後年の複数revision同時保存を持ち込まず、実migrationは変更しない。
    const database = await createLocalD1Database({
      schema: files
        .filter((file) => file < first)
        .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
        .join("\n")
        .replaceAll("initialization:organization:default", "fixture:confirmed-organization")
        .replaceAll("initialization:company:root", "fixture:confirmed-organization")
        .replaceAll("system:initialization", "fixture:organization-recorder"),
    })
    const auditMigrations = await prepareHistoricalCompanyResourceRevisionFixture(database)
    // 旧schemaのfixtureを現行readerで準備する間だけ、当時の対応表を投影する。
    // Account履歴のmigrationに達したら破棄し、実際のviewへ置き換える。
    await execSql(
      database,
      `CREATE VIEW company_account_employee_link_periods AS
      SELECT account_id, employee_id, NULL AS starts_on, NULL AS ends_on FROM company_account_employee_links`,
    )
    await execSql(
      database,
      `CREATE VIEW company_account_employee_resource_bindings AS
      SELECT '${COMPANY_DEFAULT_ORGANIZATION_ID}' AS organization_id, NULL AS resource_id, account_id, employee_id
      FROM company_account_employee_links WHERE 0`,
    )
    // 責務の公開接続がまだ存在しない旧schemaでは、現行writerの参照結果を空に固定する。
    // 対象のmigrationを適用する直前に破棄し、実際のtableを作る。
    await execSql(
      database,
      `CREATE VIEW company_responsibility_resource_bindings AS SELECT
      NULL AS resource_id, NULL AS organization_id, NULL AS employee_id, NULL AS employment_id,
      NULL AS organization_unit_id, NULL AS responsibility_type, NULL AS responsibility_id,
      NULL AS authority_scope_id, NULL AS resource_revision WHERE 0`,
    )
    await execSql(
      database,
      `CREATE VIEW company_responsibility_period_bindings AS SELECT
      NULL AS period_id, NULL AS resource_id, NULL AS period_revision, NULL AS source_revision WHERE 0`,
    )
    const f = await createCompanyAssignmentResourceTestContext(database, "confirmed")
    await f.initializeAssignment()
    await f.assignEmployeeCode(f.people[1]!.employeeId, "MANAGER-001")
    await f.assignEmployeeCode(f.people[2]!.employeeId, "MANAGER-002")
    // 旧schemaは一つの会社版に同じ資源の複数revisionを保存できない。
    // 所属開始日と同日の上長変更で、当時も保存できた既存発令を準備する。
    const changed = await f.personnel(
      {
        kind: "manager_changed",
        eventOn: restoreCalendarDate("2030-01-01"),
        employeeCode: "EMPLOYEE-001",
        departmentCode: "TEAM",
        assignmentType: "primary",
        managerEmployeeCode: "MANAGER-001",
      },
      "manager:before-migration",
    )
    if (changed instanceof Error) throw changed
    expect(changed).toMatchObject({ replayed: false })
    const before = (
      await database
        .prepare("SELECT rowid, * FROM company_personnel_reporting_bindings ORDER BY rowid")
        .all()
    ).results
    expect(before).toHaveLength(1)
    const history = await f.publicReporting("2030-03-01")
    for (const file of files.filter((file) => file >= first && !auditMigrations.has(file))) {
      if (file.endsWith("_bind_company_account_employee_resources.sql"))
        await execSql(database, "DROP VIEW company_account_employee_resource_bindings")
      if (file.endsWith("_create_company_account_employee_link_periods.sql"))
        await execSql(database, "DROP VIEW company_account_employee_link_periods")
      if (file.endsWith("_connect_company_responsibility_resources.sql")) {
        await execSql(database, "DROP VIEW company_responsibility_period_bindings")
        await execSql(database, "DROP VIEW company_responsibility_resource_bindings")
      }
      await database.batch(
        splitSqlStatements(
          alignHistoricalMigrationSql(
            readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"),
          ),
        ).map((sql) => database.prepare(sql)),
      )
    }
    expect(
      (
        await database
          .prepare(`SELECT rowid, resource_id, organization_id, resource_type, employee_id,
            employment_id, organization_unit_id, assignment_type, recorded_by_action_id,
            recorded_by_adoption_id FROM company_personnel_reporting_bindings ORDER BY rowid`)
          .all()
      ).results,
    ).toEqual(before.map((row) => ({ ...row, recorded_by_adoption_id: null })))
    expect(await f.publicReporting("2030-03-01")).toEqual(history)
    for (const sql of [
      "UPDATE company_personnel_reporting_bindings SET recorded_by_action_id = NULL",
      "DELETE FROM company_personnel_reporting_bindings",
    ]) {
      const failure = await database
        .prepare(sql)
        .run()
        .catch((cause: unknown) => cause)
      expect(failure).toBeInstanceOf(Error)
      if (!(failure instanceof Error)) throw new Error("missing immutable reporting binding guard")
      expect(failure.message).toContain("immutable")
    }
    const next = await f.personnel(
      {
        kind: "manager_changed",
        eventOn: restoreCalendarDate("2030-04-01"),
        employeeCode: "EMPLOYEE-001",
        departmentCode: "TEAM",
        assignmentType: "primary",
        managerEmployeeCode: "MANAGER-002",
      },
      "manager:after-migration",
    )
    expect(next).toMatchObject({ replayed: false })
    expect((await f.publicReporting("2030-04-01"))[0]?.attributes.managerEmployeeId).toBe(
      f.people[2]!.employeeId,
    )
    expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
    // 以降の migration（識別子の UUID 化を含む）を当てて再生するため、既定の 5 秒では足りない。
  }, 20_000)
})

test("既存の移行証跡へ接続先を推測して補わず、新しい列と制約の追加後も原文を保全する", async () => {
  const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const first = files.find((file) =>
    file.endsWith("_record_company_assignment_connection_mappings.sql"),
  )
  if (first === undefined) throw new Error("connection mapping migration missing")
  const database = await createLocalD1Database({
    schema: files
      .filter((file) => file < first)
      .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
      .join("\n")
      .replaceAll("initialization:organization:default", "fixture:confirmed-organization")
      .replaceAll("initialization:company:root", "fixture:confirmed-organization")
      .replaceAll("system:initialization", "fixture:organization-recorder"),
  })
  const auditMigrations = await prepareHistoricalCompanyResourceRevisionFixture(database)
  const f = await createCompanyAssignmentResourceTestContext(database, "confirmed")
  const sourceJson = JSON.stringify({
    employeeId: f.people[0]!.employeeId,
    periods: [],
    originalNote: "Preserve the recorded confirmation verbatim",
  })
  await database
    .prepare(`INSERT INTO company_assignment_resource_adoptions
    (command_id, employee_id, fingerprint, actor_account_id, reason, expected_revision, organization_revision, observed_on, adopted_periods, snapshot_digest, source_json, recorded_at)
    VALUES ('historical:receipt', ?1, ?2, ?3, 'Confirm historical assignments', 1, 2, '2030-01-01', 1, ?4, ?5, 123)`)
    .bind(f.people[0]!.employeeId, "a".repeat(64), f.creator.accountId, "b".repeat(64), sourceJson)
    .run()
  const before = (
    await database.prepare("SELECT rowid, * FROM company_assignment_resource_adoptions").all()
  ).results
  for (const file of files.filter((file) => file >= first && !auditMigrations.has(file))) {
    await database.batch(
      splitSqlStatements(
        alignHistoricalMigrationSql(readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8")),
      ).map((sql) => database.prepare(sql)),
    )
  }
  expect(
    (
      await database
        .prepare("SELECT rowid, * FROM company_assignment_resource_adoptions")
        .all<Record<string, unknown>>()
    ).results.map(({ id: _surrogateId, ...row }) => row),
  ).toEqual(before.map((row) => ({ ...row, mappings_json: null })))
  for (const sql of [
    "UPDATE company_assignment_resource_adoptions SET mappings_json = '[]'",
    "DELETE FROM company_assignment_resource_adoptions",
  ]) {
    const failed = await database
      .prepare(sql)
      .run()
      .catch((cause: unknown) => cause)
    expect(failed).toBeInstanceOf(Error)
  }
  expect(
    await database
      .prepare("SELECT source_json FROM company_assignment_resource_adoptions")
      .first<string>("source_json"),
  ).toBe(sourceJson)
  expect((await database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
})
