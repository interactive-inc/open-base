import type {
  ValidateWorkforceLifecycleSchedulesProps,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { validateWorkforceLifecycleSchedule } from "@/contexts/company/domain/policies/validate-workforce-lifecycle-schedule.policy"
import { validateWorkforceManagers } from "@/contexts/company/domain/policies/validate-workforce-managers.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function validateWorkforceLifecycleSchedules(
  props: ValidateWorkforceLifecycleSchedulesProps,
): WorkforceInvariantViolation | null {
  const employeeIds = new Set<EmployeeId>()
  for (const schedule of props.schedules) {
    if (employeeIds.has(schedule.employeeId)) {
      return new WorkforceInvariantViolationValue(
        "invalid_employee",
        "employee appears more than once",
      )
    }
    employeeIds.add(schedule.employeeId)
    const result = validateWorkforceLifecycleSchedule({
      schedule,
      organizationUnitPeriods: props.organizationUnitPeriods,
    })
    if (result !== null) return result
  }
  return validateWorkforceManagers(props.schedules)
}
