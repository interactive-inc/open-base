import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import {
  EmployeeResourceAdoptionCorrectionValue,
  type EmployeeResourceAdoptionConfirmation,
} from "@/contexts/company/domain/values/employee-resource-adoption-correction.value"
import { EmployeeResourceAdoptionEntity } from "@/contexts/company/domain/entities/employee-resource-adoption.entity"
import type { EmployeeResourceAdoptionTerminationInput } from "@/contexts/company/domain/values/employee-resource-adoption-termination.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"

export type EmployeeResourceAdoptionBatchInput = Readonly<{
  commandId: string
  expectedRevision: number
  observedOn: CalendarDate
  reason: string
  employees: ReadonlyArray<
    Readonly<{
      employeeId: string
      snapshotDigest: string
      corrections?: ReadonlyArray<CompanyResourceProps>
      terminationBoundaryCorrection?: EmployeeResourceAdoptionTerminationInput
    }>
  >
}>
type Props = EmployeeResourceAdoptionBatchInput &
  Readonly<{ actorAccountId: string; recordedAt: number }>

/** 確認した従業員集合を固定し、全員に同じ履歴照合条件を適用する。 */
export class EmployeeResourceAdoptionBatchEntity {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  static create(input: Props): EmployeeResourceAdoptionBatchEntity | CompanyValidationError {
    if (
      !/^\S{1,200}$/.test(input.commandId) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      input.expectedRevision > Number.MAX_SAFE_INTEGER - 100 ||
      !isCalendarDate(input.observedOn) ||
      !/^\S{1,255}$/.test(input.actorAccountId) ||
      !Number.isSafeInteger(input.recordedAt) ||
      input.recordedAt < 0 ||
      input.reason.trim() !== input.reason ||
      input.reason.length < 1 ||
      input.reason.length > 1500 ||
      input.employees.length < 1 ||
      input.employees.length > 250 ||
      new Set(input.employees.map((employee) => employee.employeeId)).size !==
        input.employees.length ||
      input.employees.some(
        (employee) =>
          !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(employee.employeeId) ||
          !/^[a-f0-9]{64}$/.test(employee.snapshotDigest) ||
          (employee.corrections !== undefined &&
            (employee.corrections.length < 1 || employee.corrections.length > 20)),
      )
    )
      return new CompanyValidationError(
        "一括接続の確認内容が不正です",
        "invalid_employee_resource_adoption_batch",
      )

    const employees: EmployeeResourceAdoptionBatchInput["employees"][number][] = []
    for (const employee of input.employees.toSorted((a, b) =>
      a.employeeId.localeCompare(b.employeeId),
    )) {
      const confirmed = { employeeId: employee.employeeId, snapshotDigest: employee.snapshotDigest }
      if (employee.corrections === undefined) {
        if (employee.terminationBoundaryCorrection !== undefined)
          return new CompanyValidationError(
            "終了境界の補正には確認した公開訂正版が必要です",
            "invalid_employee_resource_adoption_batch",
          )
        employees.push(Object.freeze(confirmed))
        continue
      }
      const corrections: CompanyResourceProps[] = []
      for (const resource of employee.corrections) {
        const correction = CompanyResourceEntity.create(resource)
        if (correction instanceof Error)
          return new CompanyValidationError(
            "訂正内容が不正です",
            "invalid_employee_resource_adoption_batch",
          )
        corrections.push(correction.toProps())
      }
      const termination =
        employee.terminationBoundaryCorrection === undefined
          ? {}
          : {
              terminationBoundaryCorrection: Object.freeze({
                ...employee.terminationBoundaryCorrection,
              }),
            }
      employees.push(
        Object.freeze({ ...confirmed, ...termination, corrections: Object.freeze(corrections) }),
      )
    }
    return new EmployeeResourceAdoptionBatchEntity(
      Object.freeze({
        ...input,
        employees: Object.freeze(employees),
      }),
    )
  }

  get revisionCount(): number {
    return Math.max(1, ...this.props.employees.map((employee) => employee.corrections?.length ?? 0))
  }

  confirm(
    snapshot: EmployeeResourceAdoptionSnapshotValue,
    commandId: string,
  ): EmployeeResourceAdoptionConfirmation | Error {
    const employee = this.props.employees.find(
      (entry) => entry.employeeId === snapshot.props.value.employee.id,
    )
    if (employee === undefined)
      return new CompanyValidationError(
        "確認対象に含まれない従業員です",
        "invalid_employee_resource_adoption_batch",
      )

    if (employee.corrections !== undefined) {
      const corrected = EmployeeResourceAdoptionCorrectionValue.create(snapshot, {
        context: {
          commandId,
          employeeId: employee.employeeId,
          snapshotDigest: employee.snapshotDigest,
          expectedRevision: this.props.expectedRevision,
          observedOn: this.props.observedOn,
          reason: this.props.reason,
          actorAccountId: this.props.actorAccountId,
          recordedAt: this.props.recordedAt,
        },
        corrections: employee.corrections,
        terminationBoundaryCorrection: employee.terminationBoundaryCorrection,
      })
      if (corrected instanceof Error) return corrected
      return corrected.props
    }
    const command = EmployeeResourceAdoptionEntity.create({
      commandId,
      ...employee,
      expectedRevision: this.props.expectedRevision,
      observedOn: this.props.observedOn,
      reason: this.props.reason,
      actorAccountId: this.props.actorAccountId,
      recordedAt: this.props.recordedAt,
      reuseExistingHistory: true,
      resources: snapshot.props.value.publicResources.map((resource) => ({
        organizationId: resource.organizationId,
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        state: resource.state,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
        attributes: resource.attributes,
      })),
    })
    if (command instanceof Error) return command
    const error = command.validate(snapshot)
    if (error !== null) return error
    return {
      command,
      termination: null,
      corrections: [],
      heads: snapshot.props.value.publicHeads.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
      })),
    }
  }
}
