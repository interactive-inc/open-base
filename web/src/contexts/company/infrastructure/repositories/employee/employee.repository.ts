import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeEntity } from "@/contexts/company/domain/entities/employee.entity"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { companyEmployeeProfileSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-profile-sql"

type Context = CompanyContext

type FindEmployeeProps =
  | Readonly<{ id: EmployeeId; asOf: CalendarDate; code?: never }>
  | Readonly<{ code: string; id?: never; asOf?: CalendarDate }>

export class EmployeeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(props: FindEmployeeProps): Promise<EmployeeEntity | null | Error> {
    if (props.id !== undefined) {
      // 接続済みの従業員は公開履歴、未接続の従業員は接続までの原記録である表から読む。
      try {
        const row = await this.c.env.DB.prepare(
          `${companyEmployeeProfileSql()}
           SELECT id, official_name AS officialName, employee_code AS employeeCode, email, phone
           FROM employee_profiles WHERE id = ?2`,
        )
          .bind(props.asOf, props.id)
          .first<{
            id: string
            officialName: string | null
            employeeCode: string | null
            email: string | null
            phone: string | null
          }>()
        if (row === null) return null
        return EmployeeEntity.restore({
          id: props.id,
          officialName: row.officialName ?? "",
          employeeCode: row.employeeCode,
          email: row.email,
          phone: row.phone,
        })
      } catch (cause) {
        return cause instanceof Error ? cause : new Error("failed to find Company employee")
      }
    }

    const employee = await new CompanyEmployeeDirectoryReadAdapter({
      env: this.c.env,
      asOf: props.asOf,
    }).findByCode(props.code)
    if (employee === null || employee instanceof Error) return employee
    return EmployeeEntity.restore(employee)
  }
}
