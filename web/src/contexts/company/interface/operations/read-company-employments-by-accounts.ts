import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentStatus } from "@/contexts/company/domain/definitions/employment-status.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentsByEmployee } from "@/contexts/company/interface/operations/read-company-employments-by-employee"

export type CompanyEmploymentsByAccounts = Readonly<{
  organizationRevision: number
  employeeIdsByAccount: ReadonlyMap<string, string>
  employmentIdsByAccount: ReadonlyMap<string, ReadonlyArray<string>>
  employmentStatusesById: ReadonlyMap<string, EmploymentStatus>
}>

/** 複数Accountの雇用を同じ会社版・有効日で解決する公開境界。 */
export async function readCompanyEmploymentsByAccounts(
  input: Readonly<{
    database: D1Database
    organizationId: string
    accountIds: ReadonlyArray<string>
    effectiveOn: CalendarDate
    includeEndedEmployments?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentsByAccounts | Error> {
  const accountIds = [...new Set(input.accountIds)]
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    accountIds.length < 1 ||
    accountIds.length > 100 ||
    !accountIds.every(CompanyResourceEntity.isIdentifier)
  ) {
    return new Error("Invalid Company Account employment query")
  }

  const links = await new D1CompanyResourceRepository({ database: input.database }).findMany({
    organizationId: input.organizationId,
    types: ["account-employee-link"],
    accountLinkAccountIds: accountIds,
    effectiveOn: input.effectiveOn,
    organizationRevision: input.organizationRevision,
  })
  if (!links.ok) return asError(links.cause)

  const employeeIdByAccount = new Map<string, string>()
  const accountIdByEmployee = new Map<string, string>()
  for (const link of links.resources) {
    const accountId = link.readText("accountId")
    const employeeId = link.readText("employeeId")
    if (accountId === null || employeeId === null || !accountIds.includes(accountId)) {
      return new Error("Company Account employee link is incomplete")
    }
    if (employeeIdByAccount.has(accountId) || accountIdByEmployee.has(employeeId)) {
      return new Error("Company Account employee link is ambiguous")
    }
    employeeIdByAccount.set(accountId, employeeId)
    accountIdByEmployee.set(employeeId, accountId)
  }

  const employmentIdsByAccount = new Map<string, ReadonlyArray<string>>(
    accountIds.map((accountId) => [accountId, []]),
  )
  if (employeeIdByAccount.size === 0) {
    return {
      organizationRevision: links.organizationRevision,
      employeeIdsByAccount: employeeIdByAccount,
      employmentIdsByAccount,
      employmentStatusesById: new Map(),
    }
  }

  const employments = await readCompanyEmploymentsByEmployee({
    database: input.database,
    organizationId: input.organizationId,
    employeeIds: [...employeeIdByAccount.values()],
    effectiveOn: input.effectiveOn,
    includeEndedEmployments: input.includeEndedEmployments,
    organizationRevision: links.organizationRevision,
  })
  if (employments instanceof Error) return employments
  for (const [accountId, employeeId] of employeeIdByAccount) {
    employmentIdsByAccount.set(accountId, employments.employmentIdsByEmployee.get(employeeId) ?? [])
  }

  return {
    organizationRevision: links.organizationRevision,
    employeeIdsByAccount: employeeIdByAccount,
    employmentIdsByAccount,
    employmentStatusesById: employments.employmentStatusesById,
  }
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Company Account employment read failed")
}
