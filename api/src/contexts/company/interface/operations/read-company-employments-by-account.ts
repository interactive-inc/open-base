import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import { readCompanyEmploymentsByAccounts } from "@/contexts/company/interface/operations/read-company-employments-by-accounts"

export type CompanyEmploymentsByAccount = Readonly<{
  organizationRevision: number
  employeeId: string | null
  employmentIds: ReadonlyArray<string>
  employmentStatusesById: ReadonlyMap<string, EmploymentStatus>
}>

/** Account 対応と雇用を、同じ会社版・有効日で解決する公開境界。 */
export async function readCompanyEmploymentsByAccount(
  input: Readonly<{
    database: D1Database
    organizationId: string
    accountId: string
    effectiveOn: CalendarDate
    includeEndedEmployments?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentsByAccount | Error> {
  const employments = await readCompanyEmploymentsByAccounts({
    database: input.database,
    organizationId: input.organizationId,
    accountIds: [input.accountId],
    effectiveOn: input.effectiveOn,
    includeEndedEmployments: input.includeEndedEmployments,
    organizationRevision: input.organizationRevision,
  })
  if (employments instanceof Error) return employments
  return {
    organizationRevision: employments.organizationRevision,
    employeeId: employments.employeeIdsByAccount.get(input.accountId) ?? null,
    employmentIds: employments.employmentIdsByAccount.get(input.accountId) ?? [],
    employmentStatusesById: employments.employmentStatusesById,
  }
}
