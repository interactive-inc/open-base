import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyResourceCorrection } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CompanyEmploymentStartCorrectionValue } from "@/contexts/company/domain/values/company-employment-start-correction.value"
import { CompanyWorkforceIdentityStartCorrectionValue } from "@/contexts/company/domain/values/company-workforce-identity-start-correction.value"
import { readCompanyStartCorrectionHistory } from "@/contexts/company/interface/operations/read-company-start-correction-history"
import { readEmploymentStartCorrectionHistory } from "@/contexts/company/interface/operations/read-employment-start-correction-history"

type Plan = Readonly<{
  resources: ReadonlyArray<CompanyResourceProps>
  corrections: ReadonlyArray<CompanyResourceCorrection>
}>

/** 指定した会社版の全雇用履歴を読み、確認済みの開始revisionに対する追記を計画する。 */
export async function planEmploymentStartCorrection(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentId: string
    expectedRevision: number
    correctsRevision: number
    startsOn: CalendarDate
    commandId: string
    recordedAt: number
  }>,
): Promise<Plan | null | Error> {
  const history = await readEmploymentStartCorrectionHistory({
    database: input.database,
    organizationId: input.organizationId,
    employmentId: input.employmentId,
    throughRevision: input.expectedRevision,
  })
  if (history === null || history instanceof Error) return history
  const employment = CompanyEmploymentStartCorrectionValue.create({
    history: history.resources,
    correctsRevision: input.correctsRevision,
    startsOn: input.startsOn,
    commandId: input.commandId,
    recordedAt: input.recordedAt,
  })
  if (employment instanceof Error) return employment

  const employeeId = history.resources[0]?.attributes["employeeId"]
  if (typeof employeeId !== "string") return new CompanyResourceValidationError("invalid_resource")
  const employeeHistory = await readCompanyStartCorrectionHistory({
    database: input.database,
    organizationId: input.organizationId,
    type: "employee",
    resourceId: employeeId,
    throughRevision: input.expectedRevision,
  })
  if (employeeHistory === null) return new CompanyResourceValidationError("invalid_resource")
  if (employeeHistory instanceof Error) return employeeHistory
  const personId = employeeHistory.resources[0]?.attributes["personId"]
  if (typeof personId !== "string") return new CompanyResourceValidationError("invalid_resource")
  const personHistory = await readCompanyStartCorrectionHistory({
    database: input.database,
    organizationId: input.organizationId,
    type: "person",
    resourceId: personId,
    throughRevision: input.expectedRevision,
  })
  if (personHistory === null) return new CompanyResourceValidationError("invalid_resource")
  if (personHistory instanceof Error) return personHistory

  const person = CompanyWorkforceIdentityStartCorrectionValue.create(
    personHistory.resources,
    input.startsOn,
  )
  if (person instanceof Error) return person
  const employee = CompanyWorkforceIdentityStartCorrectionValue.create(
    employeeHistory.resources,
    input.startsOn,
  )
  if (employee instanceof Error) return employee
  return {
    resources: [...person.resources, ...employee.resources, ...employment.resources],
    corrections: [...person.corrections, ...employee.corrections, ...employment.corrections],
  }
}
