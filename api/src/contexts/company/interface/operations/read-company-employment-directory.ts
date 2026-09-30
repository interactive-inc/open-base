import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import {
  employmentStatuses,
  type EmploymentStatus,
} from "@/contexts/company/domain/definitions/employment-status.definition"
import {
  employmentTypes,
  type EmploymentType,
} from "@/contexts/company/domain/definitions/employment-type.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentPersonNames } from "@/contexts/company/interface/operations/read-company-employment-person-names"
import { readCompanyEmploymentStartDates } from "@/contexts/company/interface/operations/read-company-employment-start-dates"

export type CompanyEmploymentDirectoryItem = Readonly<{
  employmentId: string
  employeeId: string
  personName: string
  accountId: string | null
  status: EmploymentStatus
  employmentType: EmploymentType
  startedOn: CalendarDate
  effectiveTo: CalendarDate | null
}>

export type CompanyEmploymentDirectory = Readonly<{
  organizationRevision: number
  items: ReadonlyArray<CompanyEmploymentDirectoryItem>
}>

/** 雇用・Person氏名・Account対応を同一の会社版と有効日で取得する公開境界。 */
export async function readCompanyEmploymentDirectory(
  input: Readonly<{
    database: D1Database
    organizationId: string
    effectiveOn: CalendarDate
    employmentIds?: ReadonlyArray<string>
    includeEndedEmployments?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentDirectory | Error> {
  if (!CompanyResourceEntity.isIdentifier(input.organizationId)) {
    return new Error("Invalid Company employment directory query")
  }
  if (
    input.employmentIds !== undefined &&
    (input.employmentIds.length < 1 ||
      input.employmentIds.length > 100 ||
      !input.employmentIds.every(CompanyResourceEntity.isIdentifier))
  ) {
    return new Error("Invalid Company employment directory query")
  }

  const repository = new D1CompanyResourceRepository({ database: input.database })
  const employments = await repository.findMany({
    organizationId: input.organizationId,
    types: ["employment"],
    ids: input.employmentIds,
    effectiveOn: input.effectiveOn,
    includeEnded: input.includeEndedEmployments,
    organizationRevision: input.organizationRevision,
  })
  if (!employments.ok) return asError(employments.cause)
  const organizationRevision = employments.organizationRevision
  const items: CompanyEmploymentDirectoryItem[] = []

  for (let index = 0; index < employments.resources.length; index += 100) {
    const group = employments.resources.slice(index, index + 100)
    const employeeIds = new Set<string>()
    for (const employment of group) {
      const employeeId = employment.readText("employeeId")
      if (employeeId === null) return new Error("Company employment has no employee")
      employeeIds.add(employeeId)
    }
    const [names, links, startsOnByEmployment] = await Promise.all([
      readCompanyEmploymentPersonNames({
        database: input.database,
        organizationId: input.organizationId,
        employmentIds: group.map((employment) => employment.id),
        effectiveOn: input.effectiveOn,
        includeEndedEmployments: input.includeEndedEmployments,
        organizationRevision,
      }),
      repository.findMany({
        organizationId: input.organizationId,
        types: ["account-employee-link"],
        accountLinkEmployeeIds: [...employeeIds],
        effectiveOn: input.effectiveOn,
        organizationRevision,
      }),
      readCompanyEmploymentStartDates({
        database: input.database,
        organizationId: input.organizationId,
        employmentIds: group.map((employment) => employment.id),
        organizationRevision,
      }),
    ])
    if (names instanceof Error) return names
    if (!links.ok) return asError(links.cause)
    if (startsOnByEmployment instanceof Error) return startsOnByEmployment

    const accountByEmployee = new Map<string, string>()
    for (const link of links.resources) {
      const employeeId = link.readText("employeeId")
      const accountId = link.readText("accountId")
      if (employeeId === null || accountId === null || !employeeIds.has(employeeId)) {
        return new Error("Company Account employee link is incomplete")
      }
      if (accountByEmployee.has(employeeId)) {
        return new Error("Company employee Account link is ambiguous")
      }
      accountByEmployee.set(employeeId, accountId)
    }

    for (const employment of group) {
      const employeeId = employment.readText("employeeId")
      const personName = names.names.get(employment.id)
      const status = employment.readText("status")
      const employmentType = employment.readText("employmentType")
      const startedOn = startsOnByEmployment.get(employment.id)
      if (
        employeeId === null ||
        personName === undefined ||
        !isEmploymentStatus(status) ||
        !isEmploymentType(employmentType) ||
        startedOn === undefined
      ) {
        return new Error("Company employment directory item is incomplete")
      }
      items.push({
        employmentId: employment.id,
        employeeId,
        personName,
        accountId: accountByEmployee.get(employeeId) ?? null,
        status,
        employmentType,
        startedOn,
        effectiveTo: employment.effectiveTo,
      })
    }
  }

  const employeeByAccount = new Map<string, string>()
  for (const item of items) {
    if (item.accountId === null) continue
    const existingEmployee = employeeByAccount.get(item.accountId)
    if (existingEmployee !== undefined && existingEmployee !== item.employeeId) {
      return new Error("Company Account employee link is ambiguous")
    }
    employeeByAccount.set(item.accountId, item.employeeId)
  }
  return { organizationRevision, items }
}

function isEmploymentStatus(value: string | null): value is EmploymentStatus {
  return employmentStatuses.some((status) => status === value)
}

function isEmploymentType(value: string | null): value is EmploymentType {
  return employmentTypes.some((type) => type === value)
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Company employment directory read failed")
}
