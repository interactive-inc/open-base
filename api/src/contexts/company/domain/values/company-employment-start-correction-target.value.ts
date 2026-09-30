import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { CompanyResourceEffectiveHistoryValue } from "@/contexts/company/domain/values/company-resource-effective-history.value"

type HistoricalEmployment = CompanyResourceProps & Readonly<{ correctsRevision?: number | null }>

/** 有効な雇用開始境界と、それを記録した訂正元revisionを履歴から特定する。 */
export class CompanyEmploymentStartCorrectionTargetValue {
  readonly startsOn: string
  readonly correctsRevision: number
  readonly latestRevision: number

  private constructor(startsOn: string, correctsRevision: number, latestRevision: number) {
    this.startsOn = startsOn
    this.correctsRevision = correctsRevision
    this.latestRevision = latestRevision
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<HistoricalEmployment>,
  ): CompanyEmploymentStartCorrectionTargetValue | CompanyResourceValidationError {
    const timeline = CompanyEmploymentResourceTimelineValue.create(history)
    if (timeline instanceof Error) return timeline
    const effective = CompanyResourceEffectiveHistoryValue.create(history)
    if (effective instanceof Error) return effective
    const firstActive = effective.resources
      .filter((resource) => resource.state === "active")
      .toSorted((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))[0]
    if (firstActive === undefined || firstActive.effectiveFrom !== timeline.startsOn)
      return new CompanyResourceValidationError("invalid_resource")
    return new CompanyEmploymentStartCorrectionTargetValue(
      timeline.startsOn,
      firstActive.revision,
      timeline.revision,
    )
  }
}
