import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { CompanyAssignmentResourceTimelineValue } from "@/contexts/company/domain/values/company-assignment-resource-timeline.value"

type Span = Pick<
  OrgAssignmentPeriod,
  | "employeeId"
  | "employmentId"
  | "organizationUnitId"
  | "assignmentType"
  | "positionTitle"
  | "startsOn"
  | "endsOn"
>
type Props = Readonly<{
  history: ReadonlyArray<CompanyResourceEntity>
  periods: ReadonlyArray<OrgAssignmentPeriod>
}>

/** 明示された公開所属と旧台帳の全期間・雇用・所属内容を照合する。 */
export class AssignmentResourceConnectionValue {
  private constructor(readonly head: CompanyResourceEntity) {
    Object.freeze(this)
  }

  static create(props: Props): AssignmentResourceConnectionValue | Error {
    const timeline = CompanyAssignmentResourceTimelineValue.create(props.history)
    if (timeline instanceof Error) return timeline
    if (props.periods.length === 0) return this.invalid()
    if (new Set(props.periods.map((period) => period.periodId)).size !== props.periods.length)
      return this.invalid()
    if (props.periods.some((period) => period.employeeId !== timeline.employeeId))
      return this.invalid()
    const actual = this.normalize(timeline.segments)
    const expected = this.normalize(props.periods.filter((period) => !period.isVoid))
    if (actual === null || expected === null) return this.invalid()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) return this.invalid()
    const head = props.history.toSorted((left, right) => right.revision - left.revision)[0]
    if (head === undefined) return this.invalid()
    return new AssignmentResourceConnectionValue(head)
  }

  private static normalize(spans: ReadonlyArray<Span>): ReadonlyArray<Span> | null {
    const normalized: Span[] = []
    for (const span of spans.toSorted((left, right) =>
      left.startsOn.localeCompare(right.startsOn),
    )) {
      if (span.endsOn !== null && span.startsOn >= span.endsOn) return null
      const previous = normalized.at(-1)
      if (previous !== undefined) {
        if (previous.endsOn === null || previous.endsOn > span.startsOn) return null
        if (previous.endsOn === span.startsOn && this.sameAssignment(previous, span)) {
          normalized[normalized.length - 1] = { ...previous, endsOn: span.endsOn }
          continue
        }
      }
      normalized.push(this.toSpan(span))
    }
    return normalized
  }

  private static sameAssignment(left: Span, right: Span): boolean {
    return (
      left.employeeId === right.employeeId &&
      left.employmentId === right.employmentId &&
      left.organizationUnitId === right.organizationUnitId &&
      left.assignmentType === right.assignmentType &&
      left.positionTitle === right.positionTitle
    )
  }

  private static toSpan(span: Span): Span {
    return {
      employeeId: span.employeeId,
      employmentId: span.employmentId,
      organizationUnitId: span.organizationUnitId,
      assignmentType: span.assignmentType,
      positionTitle: span.positionTitle,
      startsOn: span.startsOn,
      endsOn: span.endsOn,
    }
  }

  private static invalid(): CompanyValidationError {
    return new CompanyValidationError(
      "接続先の所属と旧台帳の所有者・雇用・所属内容・全有効期間が一致しません",
      "invalid_assignment_connection",
    )
  }
}
