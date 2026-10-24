import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import {
  employmentStatuses,
  type EmploymentStatus,
} from "@/contexts/company/domain/definitions/employment-status.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

export type CompanyEmploymentsByEmployee = Readonly<{
  organizationRevision: number
  employmentIdsByEmployee: ReadonlyMap<string, ReadonlyArray<string>>
  employmentStatusesById: ReadonlyMap<string, EmploymentStatus>
}>

/** 確定した会社版と有効日で、従業員に属する雇用IDを一括取得する公開境界。 */
export async function readCompanyEmploymentsByEmployee(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employeeIds: ReadonlyArray<string>
    effectiveOn: CalendarDate
    includeEndedEmployments?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentsByEmployee | Error> {
  const employeeIds = [...new Set(input.employeeIds)]
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    employeeIds.length < 1 ||
    employeeIds.length > 100 ||
    !employeeIds.every(CompanyResourceEntity.isIdentifier)
  ) {
    return new Error("Invalid Company employee employment query")
  }

  const result = await new D1CompanyResourceRepository({
    database: input.database,
  }).findMany({
    organizationId: input.organizationId,
    types: ["employment"],
    employmentEmployeeIds: employeeIds,
    effectiveOn: input.effectiveOn,
    includeEnded: input.includeEndedEmployments,
    organizationRevision: input.organizationRevision,
  })
  if (!result.ok)
    return result.cause instanceof Error
      ? result.cause
      : new Error("Company employee employment read failed")

  const employmentIdsByEmployee = new Map<string, string[]>(
    employeeIds.map((employeeId) => [employeeId, []]),
  )
  const employmentStatusesById = new Map<string, EmploymentStatus>()
  for (const employment of result.resources) {
    const employeeId = employment.readText("employeeId")
    const status = employment.readText("status")
    const ids = employeeId === null ? undefined : employmentIdsByEmployee.get(employeeId)
    if (ids === undefined) return new Error("Company employment has an unexpected employee")
    if (!isEmploymentStatus(status)) {
      return new Error("Company employment has an invalid status")
    }
    ids.push(employment.id)
    employmentStatusesById.set(employment.id, status)
  }
  return {
    organizationRevision: result.organizationRevision,
    employmentIdsByEmployee,
    employmentStatusesById,
  }
}

function isEmploymentStatus(value: string | null): value is EmploymentStatus {
  return employmentStatuses.some((status) => status === value)
}
