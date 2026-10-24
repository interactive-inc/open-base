import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { CompanyResourceCorrection } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CompanyEmploymentJournalChangeValue } from "@/contexts/company/domain/values/company-employment-journal-change.value"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { CompanyEmploymentStartCorrectionTargetValue } from "@/contexts/company/domain/values/company-employment-start-correction-target.value"

type HistoricalEmployment = CompanyResourceProps & Readonly<{ correctsRevision?: number | null }>

/** 確認済みの開始revisionと全雇用履歴から、追記する訂正だけを計画する。 */
export class CompanyEmploymentStartCorrectionValue {
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
    input: Readonly<{
      history: ReadonlyArray<HistoricalEmployment>
      correctsRevision: number
      startsOn: CalendarDate
      commandId: string
      recordedAt: number
    }>,
  ): CompanyEmploymentStartCorrectionValue | CompanyResourceValidationError {
    if (!isCalendarDate(input.startsOn) || !Number.isSafeInteger(input.correctsRevision))
      return new CompanyResourceValidationError("invalid_period")
    const timeline = CompanyEmploymentResourceTimelineValue.create(input.history)
    if (timeline instanceof Error) return timeline
    const firstPeriod = timeline.periods[0]
    if (
      firstPeriod === undefined ||
      timeline.startsOn === input.startsOn ||
      (firstPeriod.endsOn !== null && input.startsOn >= firstPeriod.endsOn) ||
      (timeline.endsOn !== null && input.startsOn >= timeline.endsOn)
    )
      return new CompanyResourceValidationError("invalid_period")

    const target = CompanyEmploymentStartCorrectionTargetValue.create(input.history)
    if (
      target instanceof Error ||
      target.correctsRevision !== input.correctsRevision ||
      target.startsOn !== timeline.startsOn
    )
      return new CompanyResourceValidationError("invalid_resource")

    const firstActive = input.history.find(
      (resource) => resource.revision === target.correctsRevision,
    )
    if (firstActive === undefined) return new CompanyResourceValidationError("invalid_resource")

    const employeeId = restoreWorkforceId("employee", timeline.employeeId)
    const employmentId = restoreWorkforceId("employment", timeline.employmentId)
    const expectedPeriods = timeline.periods.map((period, index) => ({
      startsOn: index === 0 ? input.startsOn : period.startsOn,
      endsOn: period.endsOn,
      status: period.status,
    }))
    const planned = CompanyEmploymentJournalChangeValue.create({
      organizationId: timeline.organizationId,
      history: input.history,
      correctingStartRevision: input.correctsRevision,
      employment: {
        periodId: employmentId,
        revision: timeline.revision,
        startsOn: input.startsOn,
        endsOn: timeline.endsOn,
        isVoid: false,
        recordedByActionId: input.commandId,
        recordedAt: input.recordedAt,
        employeeId,
        employmentId,
      },
      statuses: expectedPeriods.map((period, index) => ({
        periodId: `${input.commandId}:status:${index}`,
        revision: timeline.revision,
        startsOn: period.startsOn,
        endsOn: period.endsOn,
        isVoid: false,
        recordedByActionId: input.commandId,
        recordedAt: input.recordedAt,
        employmentPeriodId: employmentId,
        employeeId,
        status: period.status,
      })),
      initialAttributes: firstActive.attributes,
    })
    if (planned instanceof Error) return planned
    const resources = planned.resources.map((resource) => resource.toProps())
    const corrections = resources
      .filter(
        (resource) =>
          resource.effectiveFrom === timeline.startsOn || resource.effectiveFrom === input.startsOn,
      )
      .map((resource) => ({
        type: "employment" as const,
        id: resource.id,
        revision: resource.revision,
        correctsRevision: input.correctsRevision,
      }))
    if (
      corrections.length !== 2 ||
      !resources.some((resource) => resource.effectiveFrom === timeline.startsOn) ||
      !resources.some((resource) => resource.effectiveFrom === input.startsOn)
    )
      return new CompanyResourceValidationError("invalid_resource")
    const correctedHistory = [
      ...input.history,
      ...resources.map((resource) => ({
        ...resource,
        correctsRevision: corrections.some(
          (correction) => correction.revision === resource.revision,
        )
          ? input.correctsRevision
          : null,
      })),
    ]
    const after = CompanyEmploymentResourceTimelineValue.create(correctedHistory)
    if (
      after instanceof Error ||
      after.startsOn !== input.startsOn ||
      after.endsOn !== timeline.endsOn ||
      after.employmentType !== timeline.employmentType ||
      JSON.stringify(after.periods) !== JSON.stringify(expectedPeriods)
    )
      return new CompanyResourceValidationError("invalid_period")
    return new CompanyEmploymentStartCorrectionValue(resources, corrections)
  }
}
