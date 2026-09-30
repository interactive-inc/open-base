import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

export type CompanyEmploymentAccount = Readonly<{
  organizationRevision: number
  employment: Readonly<{
    employeeId: string
    status: string
    effectiveTo: CalendarDate | null
    accountId: string | null
  }> | null
}>

/** 雇用と従業員の Account 対応を同じ会社版・有効日で読む公開境界。 */
export async function readCompanyEmploymentAccount(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentId: string
    effectiveOn: CalendarDate
    includeEndedEmployment?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentAccount | Error> {
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    !CompanyResourceEntity.isIdentifier(input.employmentId)
  ) {
    return new Error("Invalid Company employment account query")
  }

  const repository = new D1CompanyResourceRepository({ database: input.database })
  const employments = await repository.findMany({
    organizationId: input.organizationId,
    types: ["employment"],
    ids: [input.employmentId],
    effectiveOn: input.effectiveOn,
    includeEnded: input.includeEndedEmployment,
    organizationRevision: input.organizationRevision,
  })
  if (!employments.ok) return asError(employments.cause)
  const employment = employments.resources[0]
  if (employment === undefined) {
    return { organizationRevision: employments.organizationRevision, employment: null }
  }

  const employeeId = employment.readText("employeeId")
  const status = employment.readText("status")
  if (employeeId === null || status === null) return new Error("Company employment is incomplete")

  const links = await repository.findMany({
    organizationId: input.organizationId,
    types: ["account-employee-link"],
    accountLinkEmployeeIds: [employeeId],
    effectiveOn: input.effectiveOn,
    organizationRevision: employments.organizationRevision,
  })
  if (!links.ok) return asError(links.cause)
  if (links.resources.length > 1) return new Error("Company employee Account link is ambiguous")
  const accountId = links.resources[0]?.readText("accountId") ?? null
  if (links.resources.length === 1 && accountId === null) {
    return new Error("Company employee Account link is incomplete")
  }

  return {
    organizationRevision: employments.organizationRevision,
    employment: { employeeId, status, effectiveTo: employment.effectiveTo, accountId },
  }
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Company employment account read failed")
}
