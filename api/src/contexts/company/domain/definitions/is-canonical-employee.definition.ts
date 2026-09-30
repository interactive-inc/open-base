import { isCanonicalEmployeeText } from "@/contexts/company/domain/definitions/is-canonical-employee-text.definition"
import type { Employee } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

/** Company Employee profileが保存方式によらない共通制約を満たすかを返す。 */
export function isCanonicalEmployee(employee: Employee): boolean {
  return (
    isCanonicalEmployeeText(employee.officialName, 200) &&
    isCanonicalEmployeeText(employee.employeeCode, 64) &&
    isCanonicalEmployeeText(employee.email, 320) &&
    isCanonicalEmployeeText(employee.phone, 64)
  )
}
