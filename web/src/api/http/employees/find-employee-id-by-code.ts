import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"

/** 委任先のCompany Employee IDを、会社営業日の従業員名簿のcodeから解決する。 */
export async function findEmployeeIdByCode(
  context: Context,
  employeeCode: string,
): Promise<EmployeeId | null> {
  const employee = await openCompanyEmployeeDirectory({ env: context.env }).findByCode(employeeCode)
  if (employee instanceof Error) throw employee
  return employee?.id ?? null
}
