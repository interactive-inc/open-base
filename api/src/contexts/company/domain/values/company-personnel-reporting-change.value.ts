import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Period = Readonly<{ startsOn: CalendarDate; endsOn: CalendarDate | null }>
type Props = Readonly<{
  resourceId: string
  employeeId: string
  organizationUnitId: string
  history: ReadonlyArray<CompanyResourceEntity>
  basis: ReadonlyArray<CompanyResourceEntity>
  coverage: ReadonlyArray<Period>
  replacement?: Period & Readonly<{ managerEmployeeId: string | null }>
}>

/** 発令が所有する指揮命令だけを訂正し、所属範囲外の期間と将来予約を区別する。 */
export class CompanyPersonnelReportingChangeValue {
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(resources: ReadonlyArray<CompanyResourceEntity>) {
    this.resources = Object.freeze([...resources])
    Object.freeze(this)
  }

  static create(props: Props): CompanyPersonnelReportingChangeValue | Error {
    const history = props.history.toSorted((left, right) => left.revision - right.revision)
    if (
      history.some(
        (resource, index) =>
          resource.revision !== index + 1 ||
          resource.type !== "reporting-relation" ||
          resource.id !== props.resourceId ||
          resource.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID ||
          resource.readText("employeeId") !== props.employeeId ||
          resource.readText("organizationUnitId") !== props.organizationUnitId,
      ) ||
      props.basis.some((resource) => !history.includes(resource))
    )
      return new CompanyResourceValidationError("invalid_resource")
    const periods = [
      ...history.map((resource) => ({
        startsOn: resource.effectiveFrom,
        endsOn: resource.effectiveTo,
      })),
      ...props.coverage,
      ...(props.replacement === undefined ? [] : [props.replacement]),
    ]
    const boundaries = [
      ...new Set(
        periods.flatMap((period) =>
          period.endsOn === null ? [period.startsOn] : [period.startsOn, period.endsOn],
        ),
      ),
    ].sort()
    const intervals: Array<{
      startsOn: CalendarDate
      endsOn: CalendarDate | null
      state: "active" | "void"
      manager: string
    }> = []
    for (const [index, date] of boundaries.entries()) {
      const current = this.at(history, date)
      const basis = this.at(props.basis, date)
      const replacement = props.replacement
      const managerEmployeeId =
        replacement !== undefined && this.contains(replacement, date)
          ? replacement.managerEmployeeId
          : basis?.state === "active" && basis.contains(date)
            ? basis.readText("managerEmployeeId")
            : null
      const active =
        managerEmployeeId !== null && props.coverage.some((period) => this.contains(period, date))
      const manager =
        managerEmployeeId ??
        current?.readText("managerEmployeeId") ??
        history[0]?.readText("managerEmployeeId")
      if (manager === undefined || manager === null) continue
      const state = active ? "active" : "void"
      const end = boundaries[index + 1] ?? null
      if (current === undefined && !active) continue
      const previous = intervals.at(-1)
      if (
        previous !== undefined &&
        previous.endsOn === date &&
        previous.state === state &&
        previous.manager === manager &&
        !history.some((resource) => resource.effectiveFrom === date)
      ) {
        previous.endsOn = end
      } else {
        intervals.push({ startsOn: date, endsOn: end, state, manager })
      }
    }
    const resources: CompanyResourceEntity[] = []
    for (const interval of intervals) {
      const { startsOn: date, endsOn: end, state, manager } = interval
      const current = this.at(history, date)
      if (
        current?.effectiveFrom === date &&
        current.effectiveTo === end &&
        current.state === state &&
        current.readText("managerEmployeeId") === manager
      )
        continue
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "reporting-relation",
        id: props.resourceId,
        revision: history.length + resources.length + 1,
        state,
        effectiveFrom: date,
        effectiveTo: end,
        attributes: {
          employeeId: props.employeeId,
          managerEmployeeId: manager,
          organizationUnitId: props.organizationUnitId,
        },
      })
      if (resource instanceof Error) return resource
      resources.push(resource)
    }
    return new CompanyPersonnelReportingChangeValue(resources)
  }

  private static contains(period: Period, date: CalendarDate): boolean {
    return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
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
