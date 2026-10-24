import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { Context } from "@/env"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"

export type CompanyAccountParticipant = Readonly<{
  accountId: AccountId
  employeeId: EmployeeId
  employeeCode: string | null
  employeeName: string
  departmentName: string | null
  status: EmploymentStatus | null
}>

/** Accountに対応する会社上の主体を、Companyと同じ期間snapshotで解決する。 */
export async function resolveCompanyAccountParticipants(
  c: Context,
  accountIds: ReadonlyArray<AccountId>,
): Promise<ReadonlyArray<CompanyAccountParticipant> | Error> {
  const entries = await openCompanyEmployeeDirectory(c).findForAccountIds(accountIds)
  if (entries instanceof Error) return entries

  return entries.map((entry) => ({
    accountId: entry.accountId,
    employeeId: entry.employee.id,
    employeeCode: entry.employee.employeeCode,
    employeeName: entry.employee.officialName,
    departmentName: entry.employee.primaryAssignment?.organizationUnitName ?? null,
    status: entry.employee.employment?.status ?? null,
  }))
}
