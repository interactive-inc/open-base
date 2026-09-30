import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { LifecycleSchedule } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"

type Props = Readonly<{
  employeeId: string
  history: ReadonlyArray<CompanyResourceEntity>
  basis: ReadonlyArray<CompanyResourceEntity>
  schedule: LifecycleSchedule
}>

/** 雇用と所属の終了に合わせて等級割当・任用・決裁資格を閉じ、将来の別任用と訂正元を保つ。 */
export class CompanyEmploymentDependentChangeValue {
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(resources: ReadonlyArray<CompanyResourceEntity>) {
    this.resources = Object.freeze([...resources])
    Object.freeze(this)
  }

  static create(props: Props): CompanyEmploymentDependentChangeValue | Error {
    const history = props.history.toSorted((left, right) => left.revision - right.revision)
    const first = history[0]
    if (
      first === undefined ||
      (first.type !== "office-assignment" &&
        first.type !== "grade-assignment" &&
        first.type !== "organizational-authority" &&
        first.type !== "responsibility-assignment" &&
        first.type !== "collective-body-membership") ||
      history.some(
        (resource, index) =>
          resource.type !== first.type ||
          resource.id !== first.id ||
          resource.organizationId !== first.organizationId ||
          resource.revision !== index + 1,
      ) ||
      props.basis.some((resource) => !history.includes(resource))
    )
      return new CompanyResourceValidationError("invalid_resource")
    if (
      [...props.schedule.employments, ...props.schedule.assignments].some(
        (period) =>
          !isCalendarDate(period.startsOn) ||
          (period.endsOn !== null &&
            (!isCalendarDate(period.endsOn) || period.endsOn <= period.startsOn)),
      )
    )
      return new CompanyResourceValidationError("invalid_period")

    const dates = [
      ...new Set(
        [
          ...history.flatMap((resource) => [resource.effectiveFrom, resource.effectiveTo]),
          ...props.schedule.employments.flatMap((period) => [period.startsOn, period.endsOn]),
          ...props.schedule.assignments.flatMap((period) => [period.startsOn, period.endsOn]),
        ]
          .filter((date) => date !== null)
          .map((date) => restoreCalendarDate(date)),
      ),
    ].sort()
    const resources: CompanyResourceEntity[] = []
    for (const [index, date] of dates.entries()) {
      const source = this.at(props.basis, date)
      const current = this.at([...history, ...resources], date)
      const reference = source ?? current
      if (reference === undefined) continue
      const employmentId = source?.readText("employmentId")
      const involved =
        source?.readText("employeeId") === props.employeeId ||
        (source?.type === "responsibility-assignment" &&
          source.readText("holderType") === "employee" &&
          source.readText("holderId") === props.employeeId)
      const employmentBound =
        source?.type === "office-assignment" ||
        source?.type === "grade-assignment" ||
        source?.type === "organizational-authority"
      const employed = props.schedule.employments.some(
        (period) =>
          !period.isVoid &&
          period.employeeId === props.employeeId &&
          (!employmentBound || period.employmentId === employmentId) &&
          period.startsOn <= date &&
          (period.endsOn === null || date < period.endsOn),
      )
      const assigned =
        source?.type !== "organizational-authority" ||
        props.schedule.assignments.some(
          (period) =>
            !period.isVoid &&
            period.employeeId === props.employeeId &&
            period.employmentPeriodId === employmentId &&
            period.startsOn <= date &&
            (period.endsOn === null || date < period.endsOn) &&
            (source.readText("scopeType") !== "organization-unit" ||
              period.organizationUnitId === source.readText("scopeId")),
        )
      const active =
        source?.state === "active" && source.contains(date) && (!involved || (employed && assigned))
      const state = active ? "active" : "void"
      const end = dates[index + 1] ?? null
      const wasActive = current?.state === "active" && current.contains(date)
      if (!active && !wasActive) continue
      if (
        active &&
        wasActive &&
        (current.effectiveTo === null || (end !== null && end <= current.effectiveTo)) &&
        Object.keys(current.attributes).length === Object.keys(reference.attributes).length &&
        Object.keys(reference.attributes).every(
          (key) => current.attributes[key] === reference.attributes[key],
        )
      )
        continue
      const resource = CompanyResourceEntity.create({
        organizationId: reference.organizationId,
        type: reference.type,
        id: reference.id,
        revision: history.length + resources.length + 1,
        state,
        effectiveFrom: date,
        effectiveTo: end,
        attributes: reference.attributes,
      })
      if (resource instanceof Error) return resource
      resources.push(resource)
    }
    return new CompanyEmploymentDependentChangeValue(resources)
  }

  private static at(history: ReadonlyArray<CompanyResourceEntity>, date: CalendarDate) {
    return history
      .filter((resource) => resource.effectiveFrom <= date)
      .toSorted(
        (left, right) =>
          right.effectiveFrom.localeCompare(left.effectiveFrom) || right.revision - left.revision,
      )[0]
  }
}
