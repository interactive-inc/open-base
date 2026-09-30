import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

export type CompanyEmploymentResourceChain = Readonly<{
  organizationRevision: number
  employmentId: string
  employmentRevision: number
  employeeId: string
  employeeRevision: number
  personId: string
  personRevision: number
}>

/** 編集に必要な雇用・従業員・人物の資源版を同じ会社版で解決する。 */
export async function readCompanyEmploymentResourceChain(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentId: string
  }>,
): Promise<CompanyEmploymentResourceChain | null | Error> {
  if (
    !CompanyResourceEntity.isIdentifier(input.organizationId) ||
    !CompanyResourceEntity.isIdentifier(input.employmentId)
  ) {
    return new Error("Invalid Company employment resource query")
  }

  const repository = new D1CompanyResourceRepository({ database: input.database })
  const employments = await repository.findMany({
    organizationId: input.organizationId,
    types: ["employment"],
    ids: [input.employmentId],
  })
  if (!employments.ok) return asError(employments.cause)
  const employment = employments.resources[0]
  if (employment === undefined) return null

  const employeeId = employment.readText("employeeId")
  if (employeeId === null) return new Error("Company employment has no employee")

  const employees = await repository.findMany({
    organizationId: input.organizationId,
    types: ["employee"],
    ids: [employeeId],
    organizationRevision: employments.organizationRevision,
  })
  if (!employees.ok) return asError(employees.cause)
  const employee = employees.resources[0]
  if (employee === undefined) return new Error("Company employee is unavailable")

  const personId = employee.readText("personId")
  if (personId === null) return new Error("Company employee has no person")

  const people = await repository.findMany({
    organizationId: input.organizationId,
    types: ["person"],
    ids: [personId],
    organizationRevision: employments.organizationRevision,
  })
  if (!people.ok) return asError(people.cause)
  const person = people.resources[0]
  if (person === undefined) return new Error("Company person is unavailable")

  return {
    organizationRevision: employments.organizationRevision,
    employmentId: employment.id,
    employmentRevision: employment.revision,
    employeeId: employee.id,
    employeeRevision: employee.revision,
    personId: person.id,
    personRevision: person.revision,
  }
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error("Company employment resource read failed")
}
