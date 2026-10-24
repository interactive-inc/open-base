import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforceLifecycleOwner(
  schedule: WorkforceLifecycleSchedule,
): WorkforceInvariantViolation | null {
  const ownedPeriods = [
    ...schedule.employments,
    ...schedule.statuses,
    ...schedule.assignments,
    ...schedule.responsibilities,
  ]
  if (ownedPeriods.some((period) => period.employeeId !== schedule.employeeId)) {
    return new WorkforceInvariantViolationValue(
      "employee_mismatch",
      "period belongs to another employee",
    )
  }
  return null
}
