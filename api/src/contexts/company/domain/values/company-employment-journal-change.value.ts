import {
  CompanyResourceEntity,
  type CompanyJsonObject,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceEffectiveHistoryValue } from "@/contexts/company/domain/values/company-resource-effective-history.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type {
  EmploymentPeriod,
  EmployeeStatusPeriod,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"

type Props = Readonly<{
  organizationId: string
  history: ReadonlyArray<CompanyResourceProps & Readonly<{ correctsRevision?: number | null }>>
  employment: EmploymentPeriod
  statuses: ReadonlyArray<EmployeeStatusPeriod>
  initialAttributes: CompanyJsonObject
  correctingStartRevision?: number
}>

/** 訂正後の期間と既存の発効境界を突き合わせ、公開雇用の変更点だけを追記する。 */
export class CompanyEmploymentJournalChangeValue {
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(resources: ReadonlyArray<CompanyResourceEntity>) {
    this.resources = Object.freeze([...resources])
    Object.freeze(this)
  }

  static create(
    props: Props,
  ): CompanyEmploymentJournalChangeValue | CompanyResourceValidationError {
    const employment = props.employment
    if (
      !isCalendarDate(employment.startsOn) ||
      (employment.endsOn !== null &&
        (!isCalendarDate(employment.endsOn) || employment.endsOn <= employment.startsOn)) ||
      props.statuses.some(
        (period) =>
          !isCalendarDate(period.startsOn) ||
          (period.endsOn !== null &&
            (!isCalendarDate(period.endsOn) || period.endsOn <= period.startsOn)),
      )
    )
      return new CompanyResourceValidationError("invalid_period")
    const history = props.history.toSorted((left, right) => left.revision - right.revision)
    if (
      history.some(
        (resource, index) =>
          resource.revision !== index + 1 ||
          resource.organizationId !== props.organizationId ||
          resource.type !== "employment" ||
          resource.id !== employment.employmentId ||
          resource.attributes["employeeId"] !== employment.employeeId,
      )
    )
      return new CompanyResourceValidationError("invalid_resource")
    const effective = CompanyResourceEffectiveHistoryValue.create(history)
    if (effective instanceof Error) return effective
    const currentHistory = effective.resources.map((resource) => resource.toProps())
    if (props.correctingStartRevision !== undefined) {
      const firstActive = currentHistory
        .filter((resource) => resource.state === "active")
        .toSorted((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]
      if (
        firstActive === undefined ||
        firstActive.revision !== props.correctingStartRevision ||
        firstActive.effectiveFrom === employment.startsOn
      )
        return new CompanyResourceValidationError("invalid_resource")
    }
    const statuses = props.statuses.filter(
      (period) => !period.isVoid && period.employmentPeriodId === employment.employmentId,
    )
    if (
      statuses.some(
        (period) =>
          period.employeeId !== employment.employeeId ||
          period.startsOn < employment.startsOn ||
          (employment.endsOn !== null &&
            (period.endsOn === null || period.endsOn > employment.endsOn)),
      )
    )
      return new CompanyResourceValidationError("invalid_period")
    const boundaries = [
      ...new Set([
        employment.startsOn,
        ...currentHistory.map((resource) => resource.effectiveFrom),
        ...statuses.map((period) => period.startsOn),
        ...[
          employment.endsOn,
          ...currentHistory.map((resource) => resource.effectiveTo),
          ...statuses.map((period) => period.endsOn),
        ].filter((date): date is string => date !== null),
      ]),
    ].sort()
    const changes: CompanyResourceEntity[] = []
    let revision = history.length
    for (const [index, date] of boundaries.entries()) {
      const current = currentHistory
        .filter((resource) => resource.effectiveFrom <= date)
        .toSorted(
          (left, right) =>
            right.effectiveFrom.localeCompare(left.effectiveFrom) || right.revision - left.revision,
        )[0]
      const attributes =
        current?.attributes ?? currentHistory[0]?.attributes ?? props.initialAttributes
      const containsEmployment =
        !employment.isVoid &&
        employment.startsOn <= date &&
        (employment.endsOn === null || date < employment.endsOn)
      const currentStatuses = statuses.filter(
        (period) => period.startsOn <= date && (period.endsOn === null || date < period.endsOn),
      )
      if (containsEmployment && currentStatuses.length !== 1)
        return new CompanyResourceValidationError("invalid_period")
      const isVoid = employment.isVoid || date < employment.startsOn
      const next = boundaries[index + 1] ?? null
      const state = isVoid ? "void" : "active"
      const nextAttributes = {
        ...attributes,
        employeeId: employment.employeeId,
        status: containsEmployment
          ? currentStatuses[0]?.status === "leave"
            ? "ON_LEAVE"
            : "ACTIVE"
          : "TERMINATED",
      }
      const beforeJson = CanonicalSystemJsonValue.create(current?.attributes ?? null)
      const afterJson = CanonicalSystemJsonValue.create(nextAttributes)
      if (beforeJson instanceof Error || afterJson instanceof Error)
        return new CompanyResourceValidationError("invalid_resource")
      if (
        current?.effectiveFrom === date &&
        current.revision !== props.correctingStartRevision &&
        current.effectiveTo === next &&
        current.state === state &&
        beforeJson.toString() === afterJson.toString()
      )
        continue
      const resource = CompanyResourceEntity.create({
        organizationId: props.organizationId,
        type: "employment",
        id: employment.employmentId,
        revision: ++revision,
        state,
        effectiveFrom: restoreCalendarDate(date),
        effectiveTo: next === null ? null : restoreCalendarDate(next),
        attributes: nextAttributes,
      })
      if (resource instanceof Error) return resource
      changes.push(resource)
    }
    return new CompanyEmploymentJournalChangeValue(changes)
  }
}
