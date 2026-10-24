import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { CompanyResponsibilityResourceTimelineValue } from "@/contexts/company/domain/values/company-responsibility-resource-timeline.value"
import type { CompanyResponsibilitySource } from "@/contexts/company/domain/values/company-responsibility-resource-timeline.value"

type Span = Pick<OrgResponsibilityPeriod, "startsOn" | "endsOn">
type Props = Readonly<{
  history: ReadonlyArray<CompanyResourceEntity>
  periods: ReadonlyArray<OrgResponsibilityPeriod>
  source: CompanyResponsibilitySource
}>

/** 明示された既存責務と旧期間台帳の全有効期間を照合する。 */
export class ResponsibilityResourceConnectionValue {
  private constructor(readonly head: CompanyResourceEntity) {
    Object.freeze(this)
  }

  static create(props: Props): ResponsibilityResourceConnectionValue | Error {
    const timeline = CompanyResponsibilityResourceTimelineValue.create(props.history, props.source)
    if (timeline instanceof Error) return timeline
    if (!this.matchesSource(props)) return this.invalid()
    const publicSpans = this.normalize(timeline.segments)
    const legacySpans = this.normalize(props.periods.filter((period) => !period.isVoid))
    if (publicSpans === null || legacySpans === null) return this.invalid()
    if (JSON.stringify(publicSpans) !== JSON.stringify(legacySpans)) return this.invalid()
    const head = props.history.toSorted((left, right) => right.revision - left.revision)[0]
    if (head === undefined) return this.invalid()
    return new ResponsibilityResourceConnectionValue(head)
  }

  private static matchesSource(props: Props): boolean {
    return (
      props.periods.length > 0 &&
      new Set(props.periods.map((period) => period.periodId)).size === props.periods.length &&
      props.history.every((resource) => resource.attributes.delegationAllowed === false) &&
      props.periods.every(
        (period) =>
          period.employeeId === props.source.employeeId &&
          period.employmentId === props.source.employmentId &&
          period.organizationUnitId === props.source.organizationUnitId &&
          period.responsibilityType === props.source.responsibilityType &&
          (period.endsOn === null || period.startsOn < period.endsOn),
      )
    )
  }

  private static normalize(spans: ReadonlyArray<Span>): ReadonlyArray<Span> | null {
    const normalized: Span[] = []
    for (const span of spans.toSorted((left, right) =>
      left.startsOn.localeCompare(right.startsOn),
    )) {
      const previous = normalized.at(-1)
      if (previous !== undefined) {
        if (previous.endsOn === null || previous.endsOn > span.startsOn) return null
        if (previous.endsOn === span.startsOn) {
          normalized[normalized.length - 1] = { startsOn: previous.startsOn, endsOn: span.endsOn }
          continue
        }
      }
      normalized.push({ startsOn: span.startsOn, endsOn: span.endsOn })
    }
    return normalized
  }

  private static invalid(): CompanyValidationError {
    return new CompanyValidationError(
      "接続先の責務と旧台帳の所有者・委任条件・全有効期間が一致しません",
      "invalid_responsibility_connection",
    )
  }
}
