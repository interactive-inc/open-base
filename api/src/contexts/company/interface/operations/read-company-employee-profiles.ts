import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { companyEmployeeProfileSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-profile-sql"

export type CompanyEmployeeProfile = Readonly<{
  officialName: string | null
  employeeCode: string | null
}>

/**
 * 業務の一覧や詳細に表示する従業員の氏名と従業員 code を、従業員ごとの正本から読む公開境界。
 *
 * 公開履歴へ接続済みの従業員は、会社営業日に有効な版を優先し、無ければ最も新しい版を読む。退職者や
 * 入社前の従業員も表示から消さない。未接続の従業員は、接続までの原記録である従業員の表を読む。
 * 存在しない従業員 ID は結果に含めない。
 */
export async function readCompanyEmployeeProfiles(
  input: Readonly<{
    database: D1Database
    employeeIds: ReadonlyArray<string>
    asOf?: CalendarDate
    now?: string
    timeZone?: string
  }>,
): Promise<ReadonlyMap<EmployeeId, CompanyEmployeeProfile> | Error> {
  const ids = [...new Set(input.employeeIds)]
  if (ids.length === 0) return new Map()
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
         SELECT id, official_name, employee_code FROM employee_profiles
         WHERE id IN (SELECT value FROM json_each(?2))`,
      )
      .bind(effectiveOn, JSON.stringify(ids))
      .all<{ id: string; official_name: string | null; employee_code: string | null }>()
    return new Map(
      rows.results.map((row) => [
        restoreWorkforceId("employee", row.id),
        { officialName: row.official_name, employeeCode: row.employee_code },
      ]),
    )
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("failed to read Company employee profiles")
  }
}
