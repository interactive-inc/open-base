import { resolveCompanyLiveEmployeeAccess } from "@/contexts/company/interface/operations/resolve-company-live-employee-access"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function resolveLiveEmployeeAccess(c: CompanyContext, employeeId: EmployeeId) {
  return resolveCompanyLiveEmployeeAccess(c, employeeId)
}
