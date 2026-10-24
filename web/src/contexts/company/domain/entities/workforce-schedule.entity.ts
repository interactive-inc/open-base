import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import {
  EmployeeEntity,
  type EmployeeProps,
} from "@/contexts/company/domain/entities/employee.entity"
import { WorkforceStateResolutionError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import {
  employmentStatuses,
  type EmploymentStatus,
} from "@/contexts/company/domain/definitions/employment-status.definition"
import {
  orgAssignmentTypes,
  type OrgAssignmentType,
} from "@/contexts/company/domain/definitions/org-assignment-type.definition"
import {
  isOrgResponsibilityType,
  type OrgResponsibilityType,
} from "@/contexts/company/domain/definitions/org-responsibility-type.definition"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import { WorkforceStateValue } from "@/contexts/company/domain/values/workforce-state.value"
import type {
  EmployeeId,
  EmploymentId,
  OrganizationUnitId,
  PersonnelActionId,
  SystemAccountId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

/** revisionごとに追記される半開有効期間 [startsOn, endsOn)。 */
export type WorkforcePeriodVersion = Readonly<{
  periodId: WorkforcePeriodId
  revision: number
  startsOn: CalendarDate
  endsOn: CalendarDate | null
  isVoid: boolean
  recordedByActionId: PersonnelActionId
  recordedAt: number
}>

export type EmploymentPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
  }>

export type EmploymentStatusPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    status: EmploymentStatus
  }>

export type OrgAssignmentPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    organizationUnitId: OrganizationUnitId
    assignmentType: OrgAssignmentType
    positionTitle: string | null
    managerEmployeeId: EmployeeId | null
  }>

export type OrgResponsibilityPeriod = WorkforcePeriodVersion &
  Readonly<{
    employmentId: EmploymentId
    employeeId: EmployeeId
    organizationUnitId: OrganizationUnitId
    responsibilityType: OrgResponsibilityType
  }>

/** System Accountとの対応はCompanyが所有し、System側からEmployeeを参照しない。 */
export type AccountEmployeeLink = Readonly<{
  accountId: SystemAccountId
  employeeId: EmployeeId
}>

/** 観測開始時点で明示され、雇用期間を推測せず保持する初期Workforce状態。 */
export type WorkforceBaselineState = Readonly<{
  asOf: CalendarDate
  status: "PRE_HIRE" | "TERMINATED"
}>

export type WorkforceScheduleProps = Readonly<{
  employee: EmployeeProps
  baselineState?: WorkforceBaselineState
  employments: ReadonlyArray<EmploymentPeriod>
  statuses: ReadonlyArray<EmploymentStatusPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
  accountLink: AccountEmployeeLink | null
}>

function violation(
  code: WorkforceInvariantViolation["code"],
  message: string,
): WorkforceInvariantViolation {
  return Object.freeze({ code, message })
}

function isCanonicalPeriod(period: WorkforcePeriodVersion): boolean {
  return (
    Number.isSafeInteger(period.revision) &&
    period.revision >= 1 &&
    Number.isSafeInteger(period.recordedAt) &&
    period.recordedAt >= 0 &&
    isCalendarDate(period.startsOn) &&
    (period.endsOn === null || (isCalendarDate(period.endsOn) && period.startsOn < period.endsOn))
  )
}

function containsDate(period: WorkforcePeriodVersion, date: CalendarDate): boolean {
  return period.startsOn <= date && (period.endsOn === null || date < period.endsOn)
}

function containsPeriod(outer: WorkforcePeriodVersion, inner: WorkforcePeriodVersion): boolean {
  return (
    outer.startsOn <= inner.startsOn &&
    (outer.endsOn === null || (inner.endsOn !== null && inner.endsOn <= outer.endsOn))
  )
}

function periodsOverlap(left: WorkforcePeriodVersion, right: WorkforcePeriodVersion): boolean {
  return (
    (right.endsOn === null || left.startsOn < right.endsOn) &&
    (left.endsOn === null || right.startsOn < left.endsOn)
  )
}

function periodsHaveOverlap<TPeriod extends WorkforcePeriodVersion>(
  periods: ReadonlyArray<TPeriod>,
): boolean {
  return periods.some((left, index) =>
    periods.slice(index + 1).some((right) => periodsOverlap(left, right)),
  )
}

function comparePeriods(
  left: { startsOn: CalendarDate; periodId: string },
  right: { startsOn: CalendarDate; periodId: string },
): number {
  return left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId)
}

function freezeRecord<TValue extends object>(value: TValue): Readonly<TValue> {
  return Object.freeze({ ...value })
}

/**
 * 一人のEmployee profile・雇用・状態・配属・責任・System Account対応を所有する集約ルート。
 */
export class WorkforceScheduleEntity {
  readonly employee: EmployeeEntity
  readonly baselineState: WorkforceBaselineState | undefined
  readonly employments: ReadonlyArray<EmploymentPeriod>
  readonly statuses: ReadonlyArray<EmploymentStatusPeriod>
  readonly assignments: ReadonlyArray<OrgAssignmentPeriod>
  readonly responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
  readonly accountLink: AccountEmployeeLink | null

  private constructor(
    props: Omit<WorkforceScheduleProps, "employee"> & { employee: EmployeeEntity },
  ) {
    this.employee = props.employee
    this.baselineState =
      props.baselineState === undefined ? undefined : freezeRecord(props.baselineState)
    this.employments = Object.freeze(props.employments.map(freezeRecord))
    this.statuses = Object.freeze(props.statuses.map(freezeRecord))
    this.assignments = Object.freeze(props.assignments.map(freezeRecord))
    this.responsibilities = Object.freeze(props.responsibilities.map(freezeRecord))
    this.accountLink = props.accountLink === null ? null : freezeRecord(props.accountLink)
    Object.freeze(this)
  }

  static restore(
    props: WorkforceScheduleProps,
  ): WorkforceScheduleEntity | WorkforceInvariantViolation {
    const employee =
      props.employee instanceof EmployeeEntity
        ? props.employee
        : EmployeeEntity.restore(props.employee)
    if (!(employee instanceof EmployeeEntity)) {
      return violation("invalid_employee", "employee profile is not canonical")
    }
    if (props.accountLink !== null && props.accountLink.employeeId !== employee.id) {
      return violation("account_link_mismatch", "account link belongs to another employee")
    }
    if (
      props.baselineState !== undefined &&
      (!isCalendarDate(props.baselineState.asOf) ||
        (props.baselineState.status !== "PRE_HIRE" && props.baselineState.status !== "TERMINATED"))
    ) {
      return violation("invalid_period", "workforce baseline state is not canonical")
    }

    const periods = [
      ...props.employments,
      ...props.statuses,
      ...props.assignments,
      ...props.responsibilities,
    ]
    const periodIds = new Set<string>()
    for (const period of periods) {
      if (!isCanonicalPeriod(period)) {
        return violation("invalid_period", "period version is not canonical")
      }
      if (period.employeeId !== employee.id) {
        return violation("employee_mismatch", "period belongs to another employee")
      }
      if (periodIds.has(period.periodId)) {
        return violation(
          "duplicate_period",
          "schedule contains more than one latest period version",
        )
      }
      periodIds.add(period.periodId)
    }

    const employments = props.employments.filter((period) => !period.isVoid)
    if (periodsHaveOverlap(employments)) {
      return violation("employment_overlap", "employment periods overlap")
    }

    const findEmployment = (employmentId: EmploymentId) =>
      employments.find(
        (employment) =>
          employment.employmentId === employmentId && employment.employeeId === employee.id,
      )

    const statuses = props.statuses.filter((period) => !period.isVoid)
    for (const status of statuses) {
      if (!employmentStatuses.includes(status.status)) {
        return violation("invalid_period", "employment status is not canonical")
      }
      const employment = findEmployment(status.employmentId)
      if (employment === undefined || !containsPeriod(employment, status)) {
        return violation("status_outside_employment", "status is outside its employment")
      }
    }
    for (const employment of employments) {
      const employmentStatuses = statuses
        .filter((status) => status.employmentId === employment.employmentId)
        .sort(comparePeriods)
      if (
        employmentStatuses.length === 0 ||
        employmentStatuses[0]?.startsOn !== employment.startsOn ||
        employmentStatuses.at(-1)?.endsOn !== employment.endsOn
      ) {
        return violation("status_gap_or_overlap", "statuses do not cover the employment")
      }
      for (let index = 0; index < employmentStatuses.length - 1; index += 1) {
        if (employmentStatuses[index]?.endsOn !== employmentStatuses[index + 1]?.startsOn) {
          return violation("status_gap_or_overlap", "statuses contain a gap or overlap")
        }
      }
    }

    const assignments = props.assignments.filter((period) => !period.isVoid)
    for (const assignment of assignments) {
      if (!orgAssignmentTypes.includes(assignment.assignmentType)) {
        return violation("invalid_period", "assignment type is not canonical")
      }
      const employment = findEmployment(assignment.employmentId)
      if (employment === undefined || !containsPeriod(employment, assignment)) {
        return violation("assignment_outside_employment", "assignment is outside its employment")
      }
      if (assignment.managerEmployeeId === assignment.employeeId) {
        return violation("self_manager", "employee cannot manage itself")
      }
    }
    if (
      periodsHaveOverlap(
        assignments.filter((assignment) => assignment.assignmentType === "PRIMARY"),
      )
    ) {
      return violation("primary_assignment_overlap", "primary assignments overlap")
    }
    for (const assignment of assignments) {
      if (
        assignments.some(
          (candidate) =>
            candidate.periodId !== assignment.periodId &&
            candidate.organizationUnitId === assignment.organizationUnitId &&
            candidate.assignmentType === assignment.assignmentType &&
            periodsOverlap(candidate, assignment),
        )
      ) {
        return violation("assignment_overlap", "equivalent assignments overlap")
      }
    }

    const responsibilities = props.responsibilities.filter((period) => !period.isVoid)
    for (const responsibility of responsibilities) {
      if (!isOrgResponsibilityType(responsibility.responsibilityType)) {
        return violation("invalid_responsibility", "responsibility type is not canonical")
      }
      const employment = findEmployment(responsibility.employmentId)
      if (employment === undefined || !containsPeriod(employment, responsibility)) {
        return violation(
          "responsibility_outside_employment",
          "responsibility holder is not employed for the full period",
        )
      }
      if (
        !periodsContainPeriod(
          assignments.filter(
            (assignment) =>
              assignment.employeeId === responsibility.employeeId &&
              assignment.employmentId === responsibility.employmentId &&
              assignment.organizationUnitId === responsibility.organizationUnitId,
          ),
          responsibility,
        )
      ) {
        return violation(
          "responsibility_without_assignment",
          "responsibility holder is not assigned to the organization unit",
        )
      }
      if (
        responsibilities.some(
          (candidate) =>
            candidate.periodId !== responsibility.periodId &&
            candidate.organizationUnitId === responsibility.organizationUnitId &&
            candidate.responsibilityType === responsibility.responsibilityType &&
            periodsOverlap(candidate, responsibility),
        )
      ) {
        return violation("responsibility_overlap", "equivalent responsibilities overlap")
      }
    }

    return new WorkforceScheduleEntity({ ...props, employee })
  }

  get employeeId(): EmployeeId {
    return this.employee.id
  }

  get boundaryDates(): ReadonlyArray<CalendarDate> {
    return Object.freeze(
      [
        ...new Set(
          [
            ...this.employments,
            ...this.statuses,
            ...this.assignments,
            ...this.responsibilities,
          ].flatMap((period) => [
            period.startsOn,
            ...(period.endsOn === null ? [] : [period.endsOn]),
          ]),
        ),
      ].sort(),
    )
  }

  findEmployment(employmentId: EmploymentId): EmploymentPeriod | undefined {
    return this.employments.find(
      (employment) =>
        !employment.isVoid &&
        employment.employmentId === employmentId &&
        employment.employeeId === this.employee.id,
    )
  }

  isActiveAt(date: CalendarDate): boolean {
    return this.statuses.some(
      (status) =>
        !status.isVoid &&
        (status.status === "ACTIVE" || status.status === "ON_LEAVE") &&
        containsDate(status, date),
    )
  }

  assignmentsAt(date: CalendarDate): ReadonlyArray<OrgAssignmentPeriod> {
    return Object.freeze(
      this.assignments.filter((assignment) => !assignment.isVoid && containsDate(assignment, date)),
    )
  }

  resolveStateAt(asOf: CalendarDate): WorkforceStateValue | WorkforceStateResolutionError {
    const employments = this.employments.filter((period) => !period.isVoid)
    const currentEmployments = employments.filter((period) => containsDate(period, asOf))
    if (currentEmployments.length > 1) {
      return new WorkforceStateResolutionError("employment_state_ambiguous")
    }

    const employment = currentEmployments[0]
    if (employment === undefined) {
      const baselineStatus =
        this.baselineState !== undefined && this.baselineState.asOf <= asOf
          ? this.baselineState.status
          : null
      const state = WorkforceStateValue.restore({
        employeeId: this.employee.id,
        asOf,
        status:
          baselineStatus ??
          (employments.some((period) => period.startsOn <= asOf) ? "TERMINATED" : "PRE_HIRE"),
        employmentId: null,
        primaryAssignment: null,
        concurrentAssignments: [],
        responsibilities: [],
      })
      return state instanceof WorkforceStateValue
        ? state
        : new WorkforceStateResolutionError("status_state_ambiguous")
    }

    const statuses = this.statuses.filter(
      (period) =>
        !period.isVoid &&
        period.employmentId === employment.employmentId &&
        containsDate(period, asOf),
    )
    if (statuses.length === 0) {
      return new WorkforceStateResolutionError("status_state_missing")
    }
    if (statuses.length > 1) {
      return new WorkforceStateResolutionError("status_state_ambiguous")
    }

    const assignments = this.assignments
      .filter(
        (period) =>
          !period.isVoid &&
          period.employmentId === employment.employmentId &&
          containsDate(period, asOf),
      )
      .sort(comparePeriods)
    const primaryAssignments = assignments.filter(
      (assignment) => assignment.assignmentType === "PRIMARY",
    )
    if (primaryAssignments.length > 1) {
      return new WorkforceStateResolutionError("primary_assignment_state_ambiguous")
    }

    const state = WorkforceStateValue.restore({
      employeeId: this.employee.id,
      asOf,
      status: statuses[0]!.status,
      employmentId: employment.employmentId,
      primaryAssignment: primaryAssignments[0] ?? null,
      concurrentAssignments: assignments.filter(
        (assignment) => assignment.assignmentType === "CONCURRENT",
      ),
      responsibilities: this.responsibilities
        .filter(
          (period) =>
            !period.isVoid &&
            period.employmentId === employment.employmentId &&
            containsDate(period, asOf),
        )
        .sort(comparePeriods),
    })
    return state instanceof WorkforceStateValue
      ? state
      : new WorkforceStateResolutionError("status_state_ambiguous")
  }

  withOrganizationPeriods(props: {
    assignments: ReadonlyArray<OrgAssignmentPeriod>
    responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
  }): WorkforceScheduleEntity | WorkforceInvariantViolation {
    return WorkforceScheduleEntity.restore({
      employee: this.employee,
      ...(this.baselineState === undefined ? {} : { baselineState: this.baselineState }),
      employments: this.employments,
      statuses: this.statuses,
      assignments: props.assignments,
      responsibilities: props.responsibilities,
      accountLink: this.accountLink,
    })
  }
}
