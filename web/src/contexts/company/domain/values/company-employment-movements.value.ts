import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"

type Period = Readonly<{ startsOn: string; endsOn: string | null }>
type Props = Readonly<{
  histories: ReadonlyArray<ReadonlyArray<CompanyResourceProps>>
  from: string
  through: string
}>

/** 確認済み雇用履歴の連続在籍を数え、兼務・契約更新を入退社として重複計上しない。 */
export class CompanyEmploymentMovementsValue {
  private constructor(
    readonly joinCount: number,
    readonly retireCount: number,
  ) {
    Object.freeze(this)
  }

  static create(props: Props): CompanyEmploymentMovementsValue | CompanyResourceValidationError {
    if (!isCalendarDate(props.from) || !isCalendarDate(props.through) || props.from > props.through)
      return new CompanyResourceValidationError("invalid_period")
    const periodsByEmployee = new Map<string, Period[]>()
    for (const history of props.histories) {
      const timeline = CompanyEmploymentResourceTimelineValue.create(history)
      if (timeline instanceof Error) return timeline
      if (timeline.startsOn === null) continue
      const key = JSON.stringify([timeline.organizationId, timeline.employeeId])
      const periods = periodsByEmployee.get(key) ?? []
      periods.push({ startsOn: timeline.startsOn, endsOn: timeline.endsOn })
      periodsByEmployee.set(key, periods)
    }
    let joinCount = 0
    let retireCount = 0
    for (const periods of periodsByEmployee.values()) {
      const merged: Period[] = []
      for (const period of periods.toSorted((left, right) =>
        left.startsOn.localeCompare(right.startsOn),
      )) {
        const previous = merged.at(-1)
        if (
          previous === undefined ||
          (previous.endsOn !== null && previous.endsOn < period.startsOn)
        ) {
          merged.push(period)
          continue
        }
        const endsOn =
          previous.endsOn === null || period.endsOn === null
            ? null
            : previous.endsOn > period.endsOn
              ? previous.endsOn
              : period.endsOn
        merged[merged.length - 1] = { startsOn: previous.startsOn, endsOn }
      }
      for (const period of merged) {
        if (props.from <= period.startsOn && period.startsOn <= props.through) joinCount += 1
        if (period.endsOn === null) continue
        // 雇用期間の終了境界は最終在籍日（退職日）の翌日。
        const retiredOn = new Date(Date.parse(`${period.endsOn}T00:00:00.000Z`) - 86_400_000)
          .toISOString()
          .slice(0, 10)
        if (props.from <= retiredOn && retiredOn <= props.through) retireCount += 1
      }
    }
    return new CompanyEmploymentMovementsValue(joinCount, retireCount)
  }
}
