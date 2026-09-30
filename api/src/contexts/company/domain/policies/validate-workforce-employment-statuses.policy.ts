import { activeWorkforcePeriods } from "@/contexts/company/domain/policies/active-workforce-periods.policy"
import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { findWorkforceEmployment } from "@/contexts/company/domain/policies/find-workforce-employment.policy"
import { workforcePeriodContainsPeriod } from "@/contexts/company/domain/policies/workforce-period-contains-period.policy"
import { workforcePeriodsHaveOverlap } from "@/contexts/company/domain/policies/workforce-periods-have-overlap.policy"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforceEmploymentStatuses(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const employments = activeWorkforcePeriods(schedule.employments)
  if (workforcePeriodsHaveOverlap(employments)) {
    return new WorkforceInvariantViolationValue("employment_overlap", "employment periods overlap")
  }

  const statuses = activeWorkforcePeriods(schedule.statuses)
  for (const status of statuses) {
    const employment = findWorkforceEmployment(schedule, status.employmentId)
    if (employment === undefined || !workforcePeriodContainsPeriod(employment, status)) {
      return new WorkforceInvariantViolationValue(
        "status_outside_employment",
        "status is outside its employment",
      )
    }
  }

  for (const employment of employments) {
    const employmentStatuses = statuses
      .filter((status) => status.employmentId === employment.employmentId)
      .sort((left, right) => left.startsOn.localeCompare(right.startsOn))
    if (
      employmentStatuses.length === 0 ||
      employmentStatuses[0]?.startsOn !== employment.startsOn ||
      employmentStatuses.at(-1)?.endsOn !== employment.endsOn
    ) {
      return new WorkforceInvariantViolationValue(
        "status_gap_or_overlap",
        "statuses do not cover the employment",
      )
    }
    for (let index = 0; index < employmentStatuses.length - 1; index += 1) {
      if (employmentStatuses[index]?.endsOn !== employmentStatuses[index + 1]?.startsOn) {
        return new WorkforceInvariantViolationValue(
          "status_gap_or_overlap",
          "statuses contain a gap or overlap",
        )
      }
    }
  }
  return null
}
