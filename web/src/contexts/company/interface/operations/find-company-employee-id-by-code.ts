import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { companyEmployeeProfileSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-profile-sql"

/**
 * 従業員 code から従業員 ID を、従業員ごとの正本で引く公開境界。
 *
 * 退職者や入社前の従業員も対象にする。該当が無ければ null、同じ code の従業員が複数あれば失敗にする。
 */
export async function findCompanyEmployeeIdByCode(
  input: Readonly<{
    database: D1Database
    employeeCode: string
    asOf?: CalendarDate
    now?: string
    timeZone?: string
  }>,
): Promise<EmployeeId | null | Error> {
  const effectiveOn =
    input.asOf ??
    resolveCompanyBusinessDate({
      now: input.now ?? new Date().toISOString(),
      timeZone: input.timeZone,
    })
  if (effectiveOn instanceof Error) return effectiveOn
  try {
    const rows = await input.database
      .prepare(
        `${companyEmployeeProfileSql()}
         SELECT id FROM employee_profiles WHERE employee_code = ?2 LIMIT 2`,
      )
      .bind(effectiveOn, input.employeeCode)
      .all<{ id: string }>()
    if (rows.results.length > 1) return new Error("Company employee code is ambiguous")
    const row = rows.results[0]
    return row === undefined ? null : restoreWorkforceId("employee", row.id)
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("failed to find Company employee")
  }
}
