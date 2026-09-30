import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyResourceCorrection } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CompanyResourceEffectiveHistoryValue } from "@/contexts/company/domain/values/company-resource-effective-history.value"

type HistoricalIdentity = CompanyResourceProps & Readonly<{ correctsRevision?: number | null }>

/** 確認済みの入社日より後に始まる Person / Employee の初期期間を、追記で拡張する。 */
export class CompanyWorkforceIdentityStartCorrectionValue {
  readonly resources: ReadonlyArray<CompanyResourceProps>
  readonly corrections: ReadonlyArray<CompanyResourceCorrection>

  private constructor(
    resources: ReadonlyArray<CompanyResourceProps>,
    corrections: ReadonlyArray<CompanyResourceCorrection>,
  ) {
    this.resources = Object.freeze([...resources])
    this.corrections = Object.freeze([...corrections])
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<HistoricalIdentity>,
    startsOn: CalendarDate,
  ): CompanyWorkforceIdentityStartCorrectionValue | CompanyResourceValidationError {
    const first = history[0]
    if (first === undefined || (first.type !== "person" && first.type !== "employee"))
      return new CompanyResourceValidationError("invalid_resource")
    if (
      history.some(
        (resource, index) =>
          resource.organizationId !== first.organizationId ||
          resource.type !== first.type ||
          resource.id !== first.id ||
          resource.revision !== index + 1,
      )
    )
      return new CompanyResourceValidationError("invalid_resource")
    const effective = CompanyResourceEffectiveHistoryValue.create(history)
    if (effective instanceof Error) return effective
    const current = effective.resources.toSorted(
      (left, right) =>
        left.effectiveFrom.localeCompare(right.effectiveFrom) || left.revision - right.revision,
    )
    const firstActive = current[0]
    if (firstActive === undefined) return new CompanyResourceValidationError("invalid_resource")
    if (firstActive.effectiveFrom <= startsOn)
      return new CompanyWorkforceIdentityStartCorrectionValue([], [])
    if (current.some((resource) => resource.state !== "active"))
      return new CompanyResourceValidationError("invalid_resource")

    const resources = current.map((resource, index) => ({
      ...resource.toProps(),
      revision: history.length + index + 1,
      effectiveFrom: index === 0 ? startsOn : resource.effectiveFrom,
    }))
    const corrections = current.map((resource, index) => ({
      type: resource.type,
      id: resource.id,
      revision: history.length + index + 1,
      correctsRevision: resource.revision,
    }))
    const after = CompanyResourceEffectiveHistoryValue.create([
      ...history,
      ...resources.map((resource, index) => ({
        ...resource,
        correctsRevision: corrections[index]?.correctsRevision,
      })),
    ])
    if (
      after instanceof Error ||
      after.resources.length !== current.length ||
      after.resources.toSorted((left, right) =>
        left.effectiveFrom.localeCompare(right.effectiveFrom),
      )[0]?.effectiveFrom !== startsOn
    )
      return new CompanyResourceValidationError("invalid_resource")
    return new CompanyWorkforceIdentityStartCorrectionValue(resources, corrections)
  }
}
