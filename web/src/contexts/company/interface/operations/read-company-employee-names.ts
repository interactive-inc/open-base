import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"

/** 業務contextへ、会社営業日時点の公開Person氏名だけを返すCompany境界。 */
export function readCompanyEmployeeNames(
  c: CompanyContext,
  employeeIds: ReadonlyArray<EmployeeId>,
): Promise<ReadonlyMap<EmployeeId, string> | Error> {
  return CompanyEmployeeDirectoryReadAdapter.findNames({
    database: c.var.database,
    now: c.env.NOW ?? new Date().toISOString(),
    timeZone: c.env.COMPANY_TIME_ZONE,
    employeeIds,
  })
}
