import type {
  ValidateWorkforceSchedulesProps,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { validateWorkforceEmployee } from "@/contexts/company/domain/policies/validate-workforce-employee.policy"
import { validateWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/validate-workforce-lifecycle-schedules.policy"

export function validateWorkforceSchedules(
  props: ValidateWorkforceSchedulesProps,
): WorkforceInvariantViolation | null {
  const accountIds = new Set<string>()
  for (const schedule of props.schedules) {
    if (schedule.accountLink !== null) {
      if (accountIds.has(schedule.accountLink.accountId)) {
        return new WorkforceInvariantViolationValue(
          "duplicate_account_link",
          "system account is linked more than once",
        )
      }
      accountIds.add(schedule.accountLink.accountId)
    }
    const employeeError = validateWorkforceEmployee(schedule)
    if (employeeError !== null) return employeeError
  }
  return validateWorkforceLifecycleSchedules({
    schedules: props.schedules.map((schedule) => ({
      employeeId: schedule.employee.id,
      employments: schedule.employments,
      statuses: schedule.statuses,
      assignments: schedule.assignments,
      responsibilities: schedule.responsibilities,
    })),
    organizationUnitPeriods: props.organizationUnitPeriods,
  })
}
