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

export type CompanyEmploymentState = Readonly<{
  employmentId: string
  status: EmploymentStatus
  employmentType: EmploymentType
}>

export type CompanyEmploymentStates = Readonly<{
  organizationRevision: number
  items: ReadonlyArray<CompanyEmploymentState>
}>

/**
 * 有効日の雇用の在籍状態と雇用形態だけを1回の読取で返す公開境界。
 *
 * 人数の集計のように氏名やAccount対応を要しない利用者が、雇用名簿の追加読取を負担しないために使う。
 */
export async function readCompanyEmploymentStates(
  input: Readonly<{
    database: D1Database
    organizationId: string
    effectiveOn: CalendarDate
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentStates | Error> {
  if (!CompanyResourceEntity.isIdentifier(input.organizationId)) {
    return new Error("Invalid Company employment states query")
  }

  const employments = await new D1CompanyResourceRepository({
    database: input.database,
  }).findMany({
    organizationId: input.organizationId,
    types: ["employment"],
    effectiveOn: input.effectiveOn,
    organizationRevision: input.organizationRevision,
  })
  if (!employments.ok) {
    return employments.cause instanceof Error
      ? employments.cause
      : new Error("Company employment states read failed")
  }

  const items: CompanyEmploymentState[] = []
  for (const employment of employments.resources) {
    const status = employment.readText("status")
    const employmentType = employment.readText("employmentType")
    if (!isEmploymentStatus(status) || !isEmploymentType(employmentType)) {
      return new Error("Company employment state is incomplete")
    }
    items.push({ employmentId: employment.id, status, employmentType })
  }

  return { organizationRevision: employments.organizationRevision, items }
}

function isEmploymentStatus(value: string | null): value is EmploymentStatus {
  return employmentStatuses.some((status) => status === value)
}

function isEmploymentType(value: string | null): value is EmploymentType {
  return employmentTypes.some((type) => type === value)
}
