import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmploymentType } from "@/contexts/company/domain/definitions/employment-type.definition"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceEffectiveHistoryValue } from "@/contexts/company/domain/values/company-resource-effective-history.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"

type StatusPeriod = Readonly<{
  startsOn: CalendarDate
  endsOn: CalendarDate | null
  status: "active" | "leave"
}>
type Props = Readonly<{
  organizationId: string
  employmentId: string
  employeeId: string
  employmentType: EmploymentType
  revision: number
  periods: ReadonlyArray<StatusPeriod>
}>

/** 版付き雇用の全履歴を、一つの連続した雇用と在籍状態の半開期間へ変換する。 */
export class CompanyEmploymentResourceTimelineValue {
  readonly organizationId: string
  readonly employmentId: string
  readonly employeeId: string
  readonly employmentType: EmploymentType
  readonly revision: number
  readonly periods: ReadonlyArray<StatusPeriod>

  private constructor(props: Props) {
    this.organizationId = props.organizationId
    this.employmentId = props.employmentId
    this.employeeId = props.employeeId
    this.employmentType = props.employmentType
    this.revision = props.revision
    this.periods = Object.freeze(props.periods.map((period) => Object.freeze(period)))
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<CompanyResourceProps>,
  ): CompanyEmploymentResourceTimelineValue | CompanyResourceValidationError {
    const revisions = history.toSorted((left, right) => left.revision - right.revision)
    const first = revisions[0]
    if (first === undefined) return new CompanyResourceValidationError("invalid_resource")
    const employeeId = first.attributes["employeeId"]
    const employmentType = revisions.at(-1)?.attributes["employmentType"]
    if (
      typeof employeeId !== "string" ||
      (employmentType !== "FULL_TIME" && employmentType !== "PART_TIME")
    ) {
      return new CompanyResourceValidationError("invalid_resource")
    }

    for (const entry of revisions.entries()) {
      const resource = entry[1]
      if (
        resource.type !== "employment" ||
        resource.organizationId !== first.organizationId ||
        resource.id !== first.id ||
        resource.attributes["employeeId"] !== employeeId ||
        (resource.attributes["employmentType"] !== "FULL_TIME" &&
          resource.attributes["employmentType"] !== "PART_TIME")
      ) {
        return new CompanyResourceValidationError("invalid_resource")
      }
      if (resource.revision !== entry[0] + 1)
        return new CompanyResourceValidationError("invalid_revision")
    }

    const confirmed = CompanyResourceEffectiveHistoryValue.create(revisions)
    if (confirmed instanceof Error) return confirmed
    const effective = confirmed.resources.toSorted((left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom),
    )
    const periods: StatusPeriod[] = []
    for (const entry of effective.entries()) {
      const resource = entry[1]
      const status = resource.readText("status")
      if (resource.state === "void" || status === "TERMINATED") continue
      if (status !== "ACTIVE" && status !== "ON_LEAVE")
        return new CompanyResourceValidationError("invalid_resource")
      const nextStart = effective[entry[0] + 1]?.effectiveFrom ?? null
      const endsOn =
        nextStart !== null && (resource.effectiveTo === null || nextStart < resource.effectiveTo)
          ? nextStart
          : resource.effectiveTo
      const previous = periods.at(-1)
      if (previous !== undefined && previous.endsOn !== resource.effectiveFrom) {
        return new CompanyResourceValidationError("invalid_period")
      }
      const currentStatus = status === "ACTIVE" ? "active" : "leave"
      if (previous !== undefined && previous.status === currentStatus) {
        periods[periods.length - 1] = { ...previous, endsOn }
        continue
      }
      periods.push({ startsOn: resource.effectiveFrom, endsOn, status: currentStatus })
    }

    return new CompanyEmploymentResourceTimelineValue({
      organizationId: first.organizationId,
      employmentId: first.id,
      employeeId,
      employmentType,
      revision: revisions.length,
      periods,
    })
  }

  get startsOn(): CalendarDate | null {
    return this.periods[0]?.startsOn ?? null
  }

  get endsOn(): CalendarDate | null {
    return this.periods.at(-1)?.endsOn ?? null
  }
}
