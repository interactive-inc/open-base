import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import { activeWorkforcePeriods } from "@/contexts/company/domain/policies/active-workforce-periods.policy"
import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { isOrgResponsibilityType } from "@/contexts/company/domain/definitions/is-org-responsibility-type.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/policies/workforce-period-contains-period.policy"
import { workforcePeriodsOverlap } from "@/contexts/company/domain/policies/workforce-periods-overlap.policy"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforceResponsibilities(
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>,
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>,
): WorkforceInvariantViolation | null {
  const responsibilities = schedules.flatMap((schedule) =>
    activeWorkforcePeriods(schedule.responsibilities),
  )
  for (const responsibility of responsibilities) {
    if (!isOrgResponsibilityType(responsibility.responsibilityType)) {
      return new WorkforceInvariantViolationValue(
        "invalid_responsibility",
        "responsibility type is not canonical",
      )
    }
    if (
      !periodsContainPeriod(
        organizationUnitPeriods.filter(
          (unit) => !unit.isVoid && unit.organizationUnitId === responsibility.organizationUnitId,
        ),
        responsibility,
      )
    ) {
      return new WorkforceInvariantViolationValue(
        "inactive_organization_unit",
        "responsibility uses an inactive organization unit",
      )
    }
    const holder = schedules.find((schedule) => schedule.employeeId === responsibility.employeeId)
    const employment = holder?.employments.find(
      (period) =>
        !period.isVoid &&
        period.employmentId === responsibility.employmentId &&
        workforcePeriodContainsPeriod(period, responsibility),
    )
    if (employment === undefined) {
      return new WorkforceInvariantViolationValue(
        "responsibility_outside_employment",
        "responsibility holder is not employed for the full period",
      )
    }
    const assignments =
      holder?.assignments.filter(
        (period) =>
          !period.isVoid &&
          period.employeeId === responsibility.employeeId &&
          period.employmentId === responsibility.employmentId &&
          period.organizationUnitId === responsibility.organizationUnitId,
      ) ?? []
    if (!periodsContainPeriod(assignments, responsibility)) {
      return new WorkforceInvariantViolationValue(
        "responsibility_without_assignment",
        "responsibility holder is not assigned to the organization unit",
      )
    }
  }

  for (const responsibility of responsibilities) {
    if (
      responsibilities.some(
        (candidate) =>
          candidate.periodId !== responsibility.periodId &&
          candidate.employeeId === responsibility.employeeId &&
          candidate.organizationUnitId === responsibility.organizationUnitId &&
          candidate.responsibilityType === responsibility.responsibilityType &&
          workforcePeriodsOverlap(candidate, responsibility),
      )
    ) {
      return new WorkforceInvariantViolationValue(
        "responsibility_overlap",
        "equivalent responsibilities overlap",
      )
    }
  }
  return null
}
