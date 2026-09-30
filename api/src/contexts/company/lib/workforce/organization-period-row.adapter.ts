import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { InvalidOrganizationPeriodProjectionError } from "@/contexts/company/domain/errors"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { WorkforceScheduleProps } from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import {
  orgAssignmentTypes,
  type OrgAssignmentType,
} from "@/contexts/company/domain/definitions/org-assignment-type.definition"
import { isOrgResponsibilityType } from "@/contexts/company/domain/definitions/is-org-responsibility-type.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

type PeriodProjectionRow = Readonly<{
  periodId: string
  revision: number
  employmentId: string
  employeeId: string
  organizationUnitId: string
  startsOn: string
  endsOn: string | null
  isVoid: boolean
  recordedByActionId: string
  recordedAt: number | Date
}>

export type OrgAssignmentProjectionRow = PeriodProjectionRow &
  Readonly<{
    assignmentType: string
    positionTitle: string | null
    managerEmployeeId: string | null
  }>

export type OrgResponsibilityProjectionRow = PeriodProjectionRow &
  Readonly<{ responsibilityType: string }>

function timestamp(value: number | Date): number {
  return value instanceof Date ? value.getTime() : value
}

function latestRows<TRow extends PeriodProjectionRow>(
  rows: ReadonlyArray<TRow>,
): ReadonlyArray<TRow> {
  const latest = new Map<string, TRow>()
  for (const row of rows) {
    const current = latest.get(row.periodId)
    if (current === undefined || current.revision < row.revision) latest.set(row.periodId, row)
  }
  return [...latest.values()].sort(
    (left, right) =>
      left.startsOn.localeCompare(right.startsOn) || left.periodId.localeCompare(right.periodId),
  )
}

function common(row: PeriodProjectionRow) {
  return {
    periodId: restoreWorkforceId("period", row.periodId),
    revision: row.revision,
    employmentId: restoreWorkforceId("employment", row.employmentId),
    employeeId: restoreWorkforceId("employee", row.employeeId),
    organizationUnitId: restoreWorkforceId("organization_unit", row.organizationUnitId),
    startsOn: restoreCalendarDate(row.startsOn),
    endsOn: row.endsOn === null ? null : restoreCalendarDate(row.endsOn),
    isVoid: row.isVoid,
    recordedByActionId: restoreWorkforceId("personnel_action", row.recordedByActionId),
    recordedAt: timestamp(row.recordedAt),
  }
}

function assignments(
  rows: ReadonlyArray<OrgAssignmentProjectionRow>,
): ReadonlyArray<OrgAssignmentPeriod> {
  return latestRows(rows).map((row) => {
    if (!orgAssignmentTypes.includes(row.assignmentType as OrgAssignmentType)) {
      throw new InvalidOrganizationPeriodProjectionError()
    }
    return {
      ...common(row),
      assignmentType: row.assignmentType as OrgAssignmentType,
      positionTitle: row.positionTitle,
      managerEmployeeId:
        row.managerEmployeeId === null
          ? null
          : restoreWorkforceId("employee", row.managerEmployeeId),
    }
  })
}

function responsibilities(
  rows: ReadonlyArray<OrgResponsibilityProjectionRow>,
): ReadonlyArray<OrgResponsibilityPeriod> {
  return latestRows(rows).map((row) => {
    if (!isOrgResponsibilityType(row.responsibilityType)) {
      throw new InvalidOrganizationPeriodProjectionError()
    }
    return {
      ...common(row),
      responsibilityType: row.responsibilityType,
    }
  })
}

/** canonical組織期間の最新revisionをEmployee lifecycle scheduleへ合成する。 */
export function attachOrganizationPeriods<
  TSchedule extends WorkforceScheduleProps | WorkforceLifecycleSchedule,
>(
  props: Readonly<{
    schedules: ReadonlyArray<TSchedule>
    assignmentRows: ReadonlyArray<OrgAssignmentProjectionRow>
    responsibilityRows: ReadonlyArray<OrgResponsibilityProjectionRow>
  }>,
): ReadonlyArray<TSchedule> {
  const assignmentsByEmployee = new Map<OrgAssignmentPeriod["employeeId"], OrgAssignmentPeriod[]>()
  for (const period of assignments(props.assignmentRows)) {
    const values = assignmentsByEmployee.get(period.employeeId) ?? []
    values.push(period)
    assignmentsByEmployee.set(period.employeeId, values)
  }
  const responsibilitiesByEmployee = new Map<
    OrgResponsibilityPeriod["employeeId"],
    OrgResponsibilityPeriod[]
  >()
  for (const period of responsibilities(props.responsibilityRows)) {
    const values = responsibilitiesByEmployee.get(period.employeeId) ?? []
    values.push(period)
    responsibilitiesByEmployee.set(period.employeeId, values)
  }
  const scheduleEmployeeId = (schedule: TSchedule) =>
    "employee" in schedule ? schedule.employee.id : schedule.employeeId
  const knownEmployees = new Set(props.schedules.map(scheduleEmployeeId))
  if (
    [...assignmentsByEmployee.keys(), ...responsibilitiesByEmployee.keys()].some(
      (employeeId) => !knownEmployees.has(employeeId),
    )
  ) {
    throw new InvalidOrganizationPeriodProjectionError()
  }

  return props.schedules.map((schedule) => {
    const employeeId = scheduleEmployeeId(schedule)
    return {
      ...schedule,
      assignments: assignmentsByEmployee.get(employeeId) ?? [],
      responsibilities: responsibilitiesByEmployee.get(employeeId) ?? [],
    }
  })
}
