import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/**
 * 人事発令が雇用の台帳へ書く行を固定する。
 *
 * 従業員と雇用の表、期間、在籍状態の期間、発令台帳、改訂番号、公開 resource は同じ事実を別々の
 * 実装が書いている。書込み経路を組み替えても 1 行も変わらないことを、この行の一覧で保証する。
 */
async function ledger(database: D1Database, employeeId: string) {
  const rows = async (sql: string) => (await database.prepare(sql).bind(employeeId).all()).results
  return {
    employments: await rows(
      `SELECT employment_type, hire_date, status, termination_date FROM company_employments
       WHERE employee_id = ?1 ORDER BY hire_date, id`,
    ),
    employmentPeriods: await rows(
      `SELECT revision, starts_on, ends_on, is_void FROM company_employment_period_versions
       WHERE employee_id = ?1 ORDER BY starts_on, revision, ends_on`,
    ),
    statusPeriods: await rows(
      `SELECT revision, status, starts_on, ends_on, is_void FROM company_employee_status_period_versions
       WHERE employee_id = ?1 ORDER BY starts_on, revision, ends_on`,
    ),
    actions: await rows(
      `SELECT kind, event_on, source_type, corrects_action_id IS NOT NULL AS corrects
       FROM company_personnel_actions WHERE employee_id = ?1 ORDER BY recorded_at, rowid`,
    ),
    lifecycle: await rows(
      "SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1",
    ),
    bindings: await rows(
      `SELECT resource_type, resource_revision, lifecycle_revision, last_action_id IS NOT NULL AS has_action
       FROM company_workforce_resource_bindings WHERE employee_id = ?1 ORDER BY resource_type, resource_revision`,
    ),
    publishedEmployments: await rows(
      `SELECT revision.revision, revision.state, revision.effective_from, revision.effective_to,
         json_extract(revision.attributes_json, '$.status') AS status,
         json_extract(revision.attributes_json, '$.employmentType') AS employment_type
       FROM company_resource_revisions AS revision
       WHERE revision.resource_type = 'employment'
         AND json_extract(revision.attributes_json, '$.employeeId') = ?1
       ORDER BY revision.effective_from, revision.revision, revision.effective_to`,
    ),
  }
}

test("休職、復職、退職、再入社が雇用の台帳へ書く行を固定する", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const employeeId = f.creator.employeeId
  const steps = [
    [
      "leave",
      {
        kind: "leave_started",
        employeeCode: "EMPLOYEE-001",
        eventOn: restoreCalendarDate("2030-02-01"),
      },
    ],
    [
      "return",
      {
        kind: "returned",
        employeeCode: "EMPLOYEE-001",
        eventOn: restoreCalendarDate("2030-03-01"),
      },
    ],
    [
      "retire",
      {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-04-30"),
      },
    ],
    [
      "rehire",
      {
        kind: "rehire",
        employmentType: "PART_TIME",
        employeeCode: "EMPLOYEE-001",
        eventOn: restoreCalendarDate("2030-05-15"),
      },
    ],
  ] as const
  const snapshots: Record<string, unknown> = { initial: await ledger(f.database, employeeId) }
  for (const [name, input] of steps) {
    const applied = await f.personnel(input, `characterization:${name}`)
    if (applied instanceof Error) throw applied
    snapshots[name] = await ledger(f.database, employeeId)
  }

  expect(snapshots).toMatchSnapshot()
}, 30_000)

/** 各期間の最新の版のうち、取消されていないものだけを返す。reader が読む有効な期間である。 */
async function effectivePeriods(database: D1Database, employeeId: string) {
  const rows = async (sql: string) => (await database.prepare(sql).bind(employeeId).all()).results
  return {
    employments: await rows(
      `SELECT employment_type, hire_date, status, termination_date FROM company_employments
       WHERE employee_id = ?1 ORDER BY hire_date, id`,
    ),
    employmentPeriods: await rows(
      `SELECT starts_on, ends_on FROM company_employment_period_versions AS period
       WHERE employee_id = ?1 AND is_void = 0 AND NOT EXISTS (
         SELECT 1 FROM company_employment_period_versions AS newer
         WHERE newer.period_id = period.period_id AND newer.revision > period.revision)
       ORDER BY starts_on`,
    ),
    statusPeriods: await rows(
      `SELECT status, starts_on, ends_on FROM company_employee_status_period_versions AS period
       WHERE employee_id = ?1 AND is_void = 0 AND NOT EXISTS (
         SELECT 1 FROM company_employee_status_period_versions AS newer
         WHERE newer.period_id = period.period_id AND newer.revision > period.revision)
       ORDER BY starts_on`,
    ),
  }
}

test("人事発令の採番で書かれた期間を持つ従業員でも、有効な期間は同じになる", async () => {
  const steps = [
    [
      "leave",
      {
        kind: "leave_started",
        employeeCode: "EMPLOYEE-001",
        eventOn: restoreCalendarDate("2030-02-01"),
      },
    ],
    [
      "return",
      {
        kind: "returned",
        employeeCode: "EMPLOYEE-001",
        eventOn: restoreCalendarDate("2030-03-01"),
      },
    ],
    [
      "retire",
      {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-04-30"),
      },
    ],
  ] as const
  const run = async (renameStatusPeriods: boolean) => {
    const f = await createCompanyAssignmentResourceTestContext()
    await f.assignEmployeeCode()
    if (renameStatusPeriods) {
      // 投影の採番ではない ID の期間を、過去の人事発令が書いた行として用意する。
      const guards = await f.database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'company_employee_status_period_versions'",
        )
        .all<{ name: string }>()
      const definitions = await f.database
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'company_employee_status_period_versions'",
        )
        .all<{ sql: string }>()
      for (const guard of guards.results) await execSql(f.database, `DROP TRIGGER "${guard.name}"`)
      await f.database
        .prepare(
          "UPDATE company_employee_status_period_versions SET period_id = 'past-action:status:1' WHERE employee_id = ?1",
        )
        .bind(f.creator.employeeId)
        .run()
      for (const definition of definitions.results)
        await execSql(f.database, definition.sql.replaceAll("\n", " "))
    }
    const views: unknown[] = []
    for (const [name, input] of steps) {
      const applied = await f.personnel(input, `transition:${name}`)
      if (applied instanceof Error) throw applied
      views.push(await effectivePeriods(f.database, f.creator.employeeId))
    }
    return views
  }

  expect(await run(true)).toEqual(await run(false))
  // fixture を 2 回作るので、既定の 5 秒では足りない製品がある。
}, 30_000)
