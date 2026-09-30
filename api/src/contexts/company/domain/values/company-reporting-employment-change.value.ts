import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"

type Period = Readonly<{ startsOn: CalendarDate; endsOn: CalendarDate | null }>
type Props = Readonly<{
  employeeId: string
  history: ReadonlyArray<CompanyResourceEntity>
  basis: ReadonlyArray<CompanyResourceEntity>
  employments: ReadonlyArray<Period>
}>

/** 雇用の変更に合わせて当事者の指揮命令を終了し、他の上長の予約と訂正前の履歴を保つ。 */
export class CompanyReportingEmploymentChangeValue {
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(resources: ReadonlyArray<CompanyResourceEntity>) {
    this.resources = Object.freeze([...resources])
    Object.freeze(this)
  }

  static create(props: Props): CompanyReportingEmploymentChangeValue | Error {
    const history = props.history.toSorted((left, right) => left.revision - right.revision)
    const first = history[0]
    if (
      first === undefined ||
      history.some(
        (resource, index) =>
          resource.type !== "reporting-relation" ||
          resource.id !== first.id ||
          resource.organizationId !== first.organizationId ||
          resource.revision !== index + 1,
      ) ||
      props.basis.some((resource) => !history.includes(resource))
    )
      return new CompanyResourceValidationError("invalid_resource")

    const dates = [
      ...new Set(
        [
          ...history.flatMap((resource) => [resource.effectiveFrom, resource.effectiveTo]),
          ...props.employments.flatMap((period) => [period.startsOn, period.endsOn]),
        ].filter((date) => date !== null),
      ),
    ].sort()
    const intervals: Array<
      Period & Readonly<{ source: CompanyResourceEntity; state: "active" | "void" }>
    > = []
    for (const [index, date] of dates.entries()) {
      const source = this.at(props.basis, date)
      const current = this.at(history, date)
      const reference = source ?? current
      if (reference === undefined) continue
      const involved =
        source?.readText("employeeId") === props.employeeId ||
        source?.readText("managerEmployeeId") === props.employeeId
      const active =
        source?.state === "active" &&
        source.contains(date) &&
        (!involved ||
          props.employments.some(
            (period) => period.startsOn <= date && (period.endsOn === null || date < period.endsOn),
          ))
      const state = active ? "active" : "void"
      const previous = intervals.at(-1)
      const end = dates[index + 1] ?? null
      if (
        previous !== undefined &&
        previous.endsOn === date &&
        previous.source === reference &&
        previous.state === state &&
        !history.some((resource) => resource.effectiveFrom === date)
      ) {
        intervals[intervals.length - 1] = { ...previous, endsOn: end }
      } else {
        intervals.push({ startsOn: date, endsOn: end, source: reference, state })
      }
    }
    const resources: CompanyResourceEntity[] = []
    for (const interval of intervals) {
      const current = this.at([...history, ...resources], interval.startsOn)
      const active = current?.state === "active" && current.contains(interval.startsOn)
      if (interval.state === "void" && !active) continue
      if (
        interval.state === "active" &&
        active &&
        (current.effectiveTo === null ||
          (interval.endsOn !== null && interval.endsOn <= current.effectiveTo)) &&
        ["employeeId", "managerEmployeeId", "organizationUnitId"].every(
          (key) => current.readText(key) === interval.source.readText(key),
        )
      )
        continue
      const resource = CompanyResourceEntity.create({
        ...interval.source,
        revision: history.length + resources.length + 1,
        state: interval.state,
        effectiveFrom: interval.startsOn,
        effectiveTo: interval.endsOn,
      })
      if (resource instanceof Error) return resource
      resources.push(resource)
    }
    return new CompanyReportingEmploymentChangeValue(resources)
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
