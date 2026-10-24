import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { toWorkforceResponsibilityType } from "@/contexts/company/domain/definitions/to-workforce-responsibility-type.definition"
import type {
  WorkforceLifecycleSchedule,
  WorkforcePeriodVersion,
} from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type {
  LifecyclePeriodBase,
  LifecycleSchedule,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { normalizeLifecycleSchedule } from "@/contexts/company/domain/definitions/normalize-lifecycle-schedule.definition"

function periodVersion(period: LifecyclePeriodBase): WorkforcePeriodVersion {
  return {
    periodId: restoreWorkforceId("period", period.periodId),
    revision: period.revision,
    startsOn: restoreCalendarDate(period.startsOn),
    endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
    isVoid: period.isVoid,
    recordedByActionId: restoreWorkforceId("personnel_action", period.recordedByActionId),
    recordedAt: period.recordedAt,
  }
}

/** Companyの人事発令scheduleを、組織検証用Workforce scheduleへ正規化する。 */
export function toWorkforceLifecycleSchedules(
  schedules: ReadonlyArray<LifecycleSchedule>,
): ReadonlyArray<WorkforceLifecycleSchedule> {
  return schedules.flatMap((source) => {
    const schedule = normalizeLifecycleSchedule(source)
    const employeeIds = new Set([
      ...schedule.employments.map((period) => period.employeeId),
      ...schedule.statuses.map((period) => period.employeeId),
      ...schedule.assignments.map((period) => period.employeeId),
      ...schedule.responsibilities.map((period) => period.employeeId),
    ])

    return [...employeeIds]
      .sort((left, right) => left.localeCompare(right))
      .map((sourceEmployeeId) => {
        const employments = schedule.employments.filter(
          (period) => period.employeeId === sourceEmployeeId,
        )

        return {
          employeeId: sourceEmployeeId,
          employments: employments.map((period) => ({
            ...periodVersion(period),
            employmentId: period.employmentId,
            employeeId: sourceEmployeeId,
          })),
          statuses: schedule.statuses
            .filter((period) => period.employeeId === sourceEmployeeId)
            .map((period) => ({
              ...periodVersion(period),
              employmentId: period.employmentPeriodId,
              employeeId: sourceEmployeeId,
              status: period.status === "active" ? ("ACTIVE" as const) : ("ON_LEAVE" as const),
            })),
          assignments: schedule.assignments
            .filter((period) => period.employeeId === sourceEmployeeId)
            .map((period) => ({
              ...periodVersion(period),
              employmentId: period.employmentPeriodId,
              employeeId: sourceEmployeeId,
              organizationUnitId: period.organizationUnitId,
              assignmentType:
                period.assignmentType === "primary"
                  ? ("PRIMARY" as const)
                  : ("CONCURRENT" as const),
              positionTitle: period.positionTitle,
              managerEmployeeId:
                period.managerEmployeeId === null ? null : period.managerEmployeeId,
            })),
          responsibilities: schedule.responsibilities
            .filter((period) => period.employeeId === sourceEmployeeId)
            .map((period) => {
              return {
                ...periodVersion(period),
                employmentId: period.employmentId,
                employeeId: sourceEmployeeId,
                organizationUnitId: period.organizationUnitId,
                responsibilityType: toWorkforceResponsibilityType(period.responsibilityType),
              }
            }),
        }
      })
  })
}
