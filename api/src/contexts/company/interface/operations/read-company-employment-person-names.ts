import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

export type CompanyEmploymentPersonNames = Readonly<{
  organizationRevision: number
  names: ReadonlyMap<string, string>
}>

/** 同じ会社版・有効日で雇用からPersonの確定氏名を一括解決する公開境界。 */
export async function readCompanyEmploymentPersonNames(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentIds: ReadonlyArray<string>
    effectiveOn: CalendarDate
    includeEndedEmployments?: boolean
    organizationRevision?: number
  }>,
): Promise<CompanyEmploymentPersonNames | Error> {
  const employmentIds = [...new Set(input.employmentIds)]
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    employmentIds.length < 1 ||
    employmentIds.length > 100 ||
    !employmentIds.every(CompanyResourceEntity.isIdentifier)
  )
    return new Error("Invalid Company employment name query")

  const repository = new D1CompanyResourceRepository({
    database: input.database,
  })
  const employments = await repository.findMany({
    organizationId: input.organizationId,
    types: ["employment"],
    ids: employmentIds,
    effectiveOn: input.effectiveOn,
    includeEnded: input.includeEndedEmployments,
    organizationRevision: input.organizationRevision,
  })
  if (!employments.ok) return asError(employments.cause)

  const organizationRevision = employments.organizationRevision
  const employeeByEmployment = new Map<string, string>()
  for (const employment of employments.resources) {
    const employeeId = employment.readText("employeeId")
    if (employeeId === null) return new Error("Company employment has no employee")
    employeeByEmployment.set(employment.id, employeeId)
  }
  if (employeeByEmployment.size === 0) {
    return { organizationRevision, names: new Map() }
  }

  const employees = await repository.findMany({
    organizationId: input.organizationId,
    types: ["employee"],
    ids: [...new Set(employeeByEmployment.values())],
    effectiveOn: input.effectiveOn,
    organizationRevision,
  })
  if (!employees.ok) return asError(employees.cause)
  const personByEmployee = new Map<string, string>()
  for (const employee of employees.resources) {
    const personId = employee.readText("personId")
    if (personId === null) return new Error("Company employee has no person")
    personByEmployee.set(employee.id, personId)
  }
  if ([...employeeByEmployment.values()].some((id) => !personByEmployee.has(id))) {
    return new Error("Company employee is unavailable")
  }

  const people = await repository.findMany({
    organizationId: input.organizationId,
    types: ["person"],
    ids: [...new Set(personByEmployee.values())],
    effectiveOn: input.effectiveOn,
    organizationRevision,
  })
  if (!people.ok) return asError(people.cause)
  const nameByPerson = new Map<string, string>()
  for (const person of people.resources) {
    const name = person.readText("officialName")
    if (name === null) return new Error("Company person has no official name")
    nameByPerson.set(person.id, name)
  }

  const names = new Map<string, string>()
  for (const [employmentId, employeeId] of employeeByEmployment) {
    const personId = personByEmployee.get(employeeId)
    const name = personId === undefined ? undefined : nameByPerson.get(personId)
    if (name === undefined) return new Error("Company person is unavailable")
    names.set(employmentId, name)
  }
  return { organizationRevision, names }
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Company employment name read failed")
}
