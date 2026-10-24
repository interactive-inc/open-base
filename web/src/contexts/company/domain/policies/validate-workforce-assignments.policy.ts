import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import { activeWorkforcePeriods } from "@/contexts/company/domain/policies/active-workforce-periods.policy"
import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { findWorkforceEmployment } from "@/contexts/company/domain/policies/find-workforce-employment.policy"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/policies/workforce-period-contains-period.policy"
import { workforcePeriodsHaveOverlap } from "@/contexts/company/domain/policies/workforce-periods-have-overlap.policy"
import { workforcePeriodsOverlap } from "@/contexts/company/domain/policies/workforce-periods-overlap.policy"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforceAssignments(
  schedule: WorkforceLifecycleSchedule,
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>,
): WorkforceInvariantViolation | null {
  const assignments = activeWorkforcePeriods(schedule.assignments)
  for (const assignment of assignments) {
    const employment = findWorkforceEmployment(schedule, assignment.employmentId)
    if (employment === undefined || !workforcePeriodContainsPeriod(employment, assignment)) {
      return new WorkforceInvariantViolationValue(
        "assignment_outside_employment",
        "assignment is outside its employment",
      )
    }
    if (
      !periodsContainPeriod(
        organizationUnitPeriods.filter(
          (unit) => !unit.isVoid && unit.organizationUnitId === assignment.organizationUnitId,
        ),
        assignment,
      )
    ) {
      return new WorkforceInvariantViolationValue(
        "inactive_organization_unit",
        "assignment uses an inactive organization unit",
      )
    }
    if (assignment.managerEmployeeId === assignment.employeeId) {
      return new WorkforceInvariantViolationValue("self_manager", "employee cannot manage itself")
    }
  }

  if (
    workforcePeriodsHaveOverlap(
      assignments.filter((assignment) => assignment.assignmentType === "PRIMARY"),
    )
  ) {
    return new WorkforceInvariantViolationValue(
      "primary_assignment_overlap",
      "primary assignments overlap",
    )
  }

  for (const assignment of assignments) {
    if (
      assignments.some(
        (candidate) =>
          candidate.periodId !== assignment.periodId &&
          candidate.organizationUnitId === assignment.organizationUnitId &&
          candidate.assignmentType === assignment.assignmentType &&
          workforcePeriodsOverlap(candidate, assignment),
      )
    ) {
      return new WorkforceInvariantViolationValue(
        "assignment_overlap",
        "equivalent assignments overlap",
      )
    }
  }
  return null
}
