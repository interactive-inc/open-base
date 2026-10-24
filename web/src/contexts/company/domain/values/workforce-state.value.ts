import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
  WorkforcePeriodVersion,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { InvalidWorkforceStateError } from "@/contexts/company/domain/errors"
import { isOrgResponsibilityType } from "@/contexts/company/domain/definitions/org-responsibility-type.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import {
  employmentStatuses,
  type EmploymentStatus,
} from "@/contexts/company/domain/definitions/employment-status.definition"
import type {
  EmployeeId,
  EmploymentId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

export type WorkforceStateProps = Readonly<{
  employeeId: EmployeeId
  asOf: CalendarDate
  status: EmploymentStatus
  employmentId: EmploymentId | null
  primaryAssignment: OrgAssignmentPeriod | null
  concurrentAssignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

/** 一人のEmployeeについて、同一基準日時点で確定したWorkforce状態。 */
export class WorkforceStateValue {
  readonly employeeId: EmployeeId
  readonly asOf: CalendarDate
  readonly status: EmploymentStatus
  readonly employmentId: EmploymentId | null
  readonly primaryAssignment: OrgAssignmentPeriod | null
  readonly concurrentAssignments: ReadonlyArray<OrgAssignmentPeriod>
  readonly responsibilities: ReadonlyArray<OrgResponsibilityPeriod>

  private static isCanonicalPeriod(period: WorkforcePeriodVersion, asOf: CalendarDate): boolean {
    return (
      Number.isSafeInteger(period.revision) &&
      period.revision >= 1 &&
      Number.isSafeInteger(period.recordedAt) &&
      period.recordedAt >= 0 &&
      isCalendarDate(period.startsOn) &&
      (period.endsOn === null ||
        (isCalendarDate(period.endsOn) && period.startsOn < period.endsOn)) &&
      !period.isVoid &&
      period.startsOn <= asOf &&
      (period.endsOn === null || asOf < period.endsOn)
    )
  }

  private static freezePeriod<TPeriod extends object>(period: TPeriod): Readonly<TPeriod> {
    return Object.freeze({ ...period })
  }

  private constructor(props: WorkforceStateProps) {
    this.employeeId = props.employeeId
    this.asOf = props.asOf
    this.status = props.status
    this.employmentId = props.employmentId
    this.primaryAssignment =
      props.primaryAssignment === null
        ? null
        : WorkforceStateValue.freezePeriod(props.primaryAssignment)
    this.concurrentAssignments = Object.freeze(
      props.concurrentAssignments.map((period) => WorkforceStateValue.freezePeriod(period)),
    )
    this.responsibilities = Object.freeze(
      props.responsibilities.map((period) => WorkforceStateValue.freezePeriod(period)),
    )
    Object.freeze(this)
  }

  static restore(props: WorkforceStateProps): WorkforceStateValue | InvalidWorkforceStateError {
    if (!isCalendarDate(props.asOf) || !employmentStatuses.includes(props.status)) {
      return new InvalidWorkforceStateError()
    }
    const assignments = [
      ...(props.primaryAssignment === null ? [] : [props.primaryAssignment]),
      ...props.concurrentAssignments,
    ]
    if (props.employmentId === null) {
      return assignments.length === 0 && props.responsibilities.length === 0
        ? new WorkforceStateValue(props)
        : new InvalidWorkforceStateError()
    }

    const periodIds = new Set<string>()
    for (const assignment of assignments) {
      if (
        assignment.employeeId !== props.employeeId ||
        assignment.employmentId !== props.employmentId ||
        !WorkforceStateValue.isCanonicalPeriod(assignment, props.asOf) ||
        (assignment === props.primaryAssignment
          ? assignment.assignmentType !== "PRIMARY"
          : assignment.assignmentType !== "CONCURRENT") ||
        periodIds.has(assignment.periodId)
      ) {
        return new InvalidWorkforceStateError()
      }
      periodIds.add(assignment.periodId)
    }
    for (const responsibility of props.responsibilities) {
      if (
        responsibility.employeeId !== props.employeeId ||
        responsibility.employmentId !== props.employmentId ||
        !WorkforceStateValue.isCanonicalPeriod(responsibility, props.asOf) ||
        !isOrgResponsibilityType(responsibility.responsibilityType) ||
        !assignments.some(
          (assignment) => assignment.organizationUnitId === responsibility.organizationUnitId,
        ) ||
        periodIds.has(responsibility.periodId)
      ) {
        return new InvalidWorkforceStateError()
      }
      periodIds.add(responsibility.periodId)
    }
    return new WorkforceStateValue(props)
  }

  get assignments(): ReadonlyArray<OrgAssignmentPeriod> {
    return Object.freeze([
      ...(this.primaryAssignment === null ? [] : [this.primaryAssignment]),
      ...this.concurrentAssignments,
    ])
  }

  get isEligible(): boolean {
    return this.employmentId !== null && (this.status === "ACTIVE" || this.status === "ON_LEAVE")
  }
}
