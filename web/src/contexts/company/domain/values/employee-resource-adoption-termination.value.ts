import type { EmployeeResourceAdoptionSnapshot } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { nextCalendarDate } from "@/contexts/company/domain/definitions/next-calendar-date.definition"

export type EmployeeResourceAdoptionTerminationInput = Readonly<{
  employmentId: string
  endsOn: string
}>
type Props = Readonly<{
  source: EmployeeResourceAdoptionSnapshot
  employment: EmployeeResourceAdoptionSnapshot["employmentPeriods"][number]
  status: EmployeeResourceAdoptionSnapshot["statusPeriods"][number]
  previousActionId: string
}>

/** 退職日と既存の公開終了日で裏付けられた初期期間だけを翌日まで補正する。 */
export class EmployeeResourceAdoptionTerminationValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(
    source: EmployeeResourceAdoptionSnapshot,
    input: EmployeeResourceAdoptionTerminationInput,
  ): EmployeeResourceAdoptionTerminationValue | CompanyValidationError {
    const contract = source.employments.find((row) => row.id === input.employmentId)
    const periods = source.employmentPeriods.filter((row) => row.periodId === input.employmentId)
    const statuses = source.statusPeriods.filter(
      (row) => row.employmentPeriodId === input.employmentId,
    )
    const period = periods[0]
    const status = statuses[0]
    if (
      source.bindings.length !== 0 ||
      (source.lifecycleRevision !== 0 && source.lifecycleRevision !== 1) ||
      contract === undefined ||
      contract.terminationDate === null ||
      contract.status !== "TERMINATED" ||
      nextCalendarDate(contract.terminationDate) !== input.endsOn ||
      periods.length !== 1 ||
      statuses.length !== 1 ||
      period === undefined ||
      status === undefined ||
      period.revision !== 1 ||
      status.revision !== 1 ||
      period.isVoid !== 0 ||
      status.isVoid !== 0 ||
      period.employeeId !== source.employee.id ||
      status.employeeId !== source.employee.id ||
      contract.employeeId !== source.employee.id ||
      contract.hireDate !== period.startsOn ||
      status.startsOn !== period.startsOn ||
      period.endsOn !== contract.terminationDate ||
      status.endsOn !== contract.terminationDate ||
      period.recordedByActionId !== status.recordedByActionId ||
      !source.publicResources.some(
        (resource) =>
          resource.type === "employment" &&
          resource.id === contract.id &&
          resource.revision === 1 &&
          resource.attributes["employeeId"] === source.employee.id &&
          resource.effectiveFrom === contract.hireDate &&
          resource.effectiveTo === input.endsOn,
      )
    )
      return new CompanyValidationError(
        "退職期間の補正根拠が一致しません",
        "invalid_employee_termination_boundary_correction",
      )
    const employment = Object.freeze({ ...period, revision: 2, endsOn: input.endsOn })
    const correctedStatus = Object.freeze({ ...status, revision: 2, endsOn: input.endsOn })
    return new EmployeeResourceAdoptionTerminationValue(
      Object.freeze({
        source: Object.freeze({
          ...source,
          lifecycleRevision: source.lifecycleRevision + 1,
          employmentPeriods: Object.freeze([...source.employmentPeriods, employment]),
          statusPeriods: Object.freeze([...source.statusPeriods, correctedStatus]),
        }),
        employment,
        status: correctedStatus,
        previousActionId: period.recordedByActionId,
      }),
    )
  }
}
