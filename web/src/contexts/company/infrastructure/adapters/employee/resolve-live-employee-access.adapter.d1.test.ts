import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"
import { createEmployeeEmploymentTestDatabase } from "@/contexts/company/infrastructure/adapters/employee/lib/create-employee-employment-test-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const employeeId = restoreWorkforceId("employee", "employee:1")

function resolve(database: D1Database, now: string, timeZone: string | undefined = "Asia/Tokyo") {
  return new ResolveLiveEmployeeAccessAdapter({
    env: { DB: database, NOW: now, COMPANY_TIME_ZONE: timeZone },
  }).resolveLiveEmployeeAccess(employeeId)
}

describe("Companyの在籍期間に基づくアクセス判定", () => {
  test("一括参照でも在籍・休職・未在籍を人ごとに区別し、重複した状態で部分結果を返さない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employees VALUES ('employee:2', 'Second Person', 'E002', NULL, NULL);
      INSERT INTO company_workforce_resource_bindings VALUES
        ('employee', 'employee:2', '${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee:2');
      INSERT INTO company_resource_revisions VALUES
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'person', 'person:2', 1, 'active', '2026-01-01', NULL, '{"officialName":"Second Person"}'),
        ('${COMPANY_DEFAULT_ORGANIZATION_ID}', 'employee', 'employee:2', 1, 'active', '2026-01-01', NULL, '{"personId":"person:2","employeeCode":"E002"}');
      INSERT INTO company_employment_period_versions VALUES ('employment:2', 1, 'employee:2', '2026-01-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES ('status:2', 1, 'employment:2', 'employee:2', 'leave', '2026-01-01', NULL, 0);
    `)
    const second = restoreWorkforceId("employee", "employee:2")
    const missing = restoreWorkforceId("employee", "employee:missing")
    const adapter = new ResolveLiveEmployeeAccessAdapter({
      env: { DB: database, NOW: "2026-08-01T00:00:00Z", COMPANY_TIME_ZONE: "UTC" },
    })
    const result = await adapter.resolveMany([employeeId, second, employeeId, missing])
    if (result instanceof Error) throw result
    expect(result.size).toBe(3)
    expect(result.get(employeeId)).toMatchObject({ status: "ACTIVE" })
    expect(result.get(second)).toMatchObject({ status: "ON_LEAVE" })
    expect(result.get(missing)).toBeNull()
    await execSql(
      database,
      `INSERT INTO company_employee_status_period_versions VALUES ('status:overlap', 1, 'employment:2', 'employee:2', 'active', '2026-07-01', NULL, 0)`,
    )
    expect(await adapter.resolveMany([employeeId, second])).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
    await execSql(database, "DROP TABLE company_employment_period_versions")
    expect(await adapter.resolveMany([])).toEqual(new Map())
    expect(await adapter.resolveMany([employeeId])).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
  })

  test("将来退職の予約で表示用statusがTERMINATEDになっても、退職日中は在籍している", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    expect(await resolve(database, "2026-09-30T14:59:59Z")).toEqual({
      status: "ACTIVE",
      source: "employment",
      businessDate: "2026-09-30",
    })
    expect(await resolve(database, "2026-09-30T15:00:00Z")).toBeNull()
  })

  test("休職と復職は発効日の境界で切り替わり、表示用statusに依存しない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-07-01', 0),
        ('status:leave', 1, 'employment:1', 'employee:1', 'leave', '2026-07-01', '2026-09-01', 0),
        ('status:return', 1, 'employment:1', 'employee:1', 'active', '2026-09-01', '2026-10-01', 0);
    `)
    expect(await resolve(database, "2026-06-30T14:59:59Z")).toMatchObject({ status: "ACTIVE" })
    expect(await resolve(database, "2026-06-30T15:00:00Z")).toMatchObject({ status: "ON_LEAVE" })
    expect(await resolve(database, "2026-08-31T15:00:00Z")).toMatchObject({ status: "ACTIVE" })
  })

  test("雇用期間の最新訂正を使い、古い終了日でアクセスを止めない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employment_period_versions VALUES
        ('employment:1', 2, 'employee:1', '2026-01-01', '2026-11-01', 0);
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-11-01', 0);
    `)
    expect(await resolve(database, "2026-10-01T00:00:00Z")).toMatchObject({ status: "ACTIVE" })
  })

  test("取消済みの雇用は古いrevisionから復活しない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      UPDATE company_employments SET status = 'ACTIVE';
      INSERT INTO company_employment_period_versions VALUES
        ('employment:1', 2, 'employee:1', '2026-01-01', '2026-10-01', 1);
    `)
    expect(await resolve(database, "2026-08-01T00:00:00Z")).toBeNull()
  })

  test("雇用期間に状態がなければ、表示用ACTIVEへfallbackせずエラーを返す", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      UPDATE company_employments SET status = 'ACTIVE';
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:1', 2, 'employment:1', 'employee:1', 'active', '2026-01-01', '2026-10-01', 1);
    `)
    expect(await resolve(database, "2026-08-01T00:00:00Z")).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
  })

  test("重なる状態期間をどちらか一方へ決めずに拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:overlap', 1, 'employment:1', 'employee:1', 'leave', '2026-07-01', '2026-09-01', 0);
    `)
    expect(await resolve(database, "2026-08-01T00:00:00Z")).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
  })

  test("重なる雇用期間をどちらか一方へ決めずに拒否する", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      INSERT INTO company_employment_period_versions VALUES
        ('employment:2', 1, 'employee:1', '2026-07-01', NULL, 0);
      INSERT INTO company_employee_status_period_versions VALUES
        ('status:2', 1, 'employment:2', 'employee:1', 'active', '2026-07-01', NULL, 0);
    `)
    expect(await resolve(database, "2026-08-01T00:00:00Z")).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
  })

  test("他人の状態期間を雇用に結び付けてアクセスを許可しない", async () => {
    const database = await createEmployeeEmploymentTestDatabase(`
      UPDATE company_employee_status_period_versions SET employee_id = 'employee:other';
    `)
    expect(await resolve(database, "2026-08-01T00:00:00Z")).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
  })

  test("入社前はアクセスを許可しない", async () => {
    expect(
      await resolve(await createEmployeeEmploymentTestDatabase(), "2025-12-31T14:59:59Z"),
    ).toBeNull()
  })

  test("会社timezoneがない場合とDB障害を非在籍へ畳まない", async () => {
    const database = await createEmployeeEmploymentTestDatabase()
    expect(await resolve(database, "2026-08-01T00:00:00Z", "")).toMatchObject({
      code: "company_timezone_unavailable",
    })
    await execSql(database, "DROP TABLE company_employment_period_versions")
    expect(await resolve(database, "2026-08-01T00:00:00Z")).toMatchObject({
      code: "lifecycle_projection_mismatch",
    })
  })
})
