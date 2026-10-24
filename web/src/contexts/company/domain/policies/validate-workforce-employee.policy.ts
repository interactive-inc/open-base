import { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import { isCanonicalEmployee } from "@/contexts/company/domain/definitions/is-canonical-employee.definition"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { WorkforceSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export function validateWorkforceEmployee(
  schedule: WorkforceSchedule,
): WorkforceInvariantViolation | null {
  const { employee } = schedule
  if (!isCanonicalEmployee(employee)) {
    return new WorkforceInvariantViolationValue(
      "invalid_employee",
      "employee profile is not canonical",
    )
  }

  if (schedule.accountLink !== null && schedule.accountLink.employeeId !== employee.id) {
    return new WorkforceInvariantViolationValue(
      "account_link_mismatch",
      "account link belongs to another employee",
    )
  }
  return null
}
