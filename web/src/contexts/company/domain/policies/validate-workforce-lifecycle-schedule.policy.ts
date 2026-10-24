import type {
  ValidateWorkforceLifecycleScheduleProps,
  WorkforceInvariantViolation,
} from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import { validateWorkforceAssignments } from "@/contexts/company/domain/policies/validate-workforce-assignments.policy"
import { validateWorkforceEmploymentStatuses } from "@/contexts/company/domain/policies/validate-workforce-employment-statuses.policy"
import { validateWorkforceLifecycleOwner } from "@/contexts/company/domain/policies/validate-workforce-lifecycle-owner.policy"
import { validateWorkforcePeriodVersions } from "@/contexts/company/domain/policies/validate-workforce-period-versions.policy"
import { validateWorkforceResponsibilities } from "@/contexts/company/domain/policies/validate-workforce-responsibilities.policy"

export function validateWorkforceLifecycleSchedule(
  props: ValidateWorkforceLifecycleScheduleProps,
): WorkforceInvariantViolation | null {
  return (
    validateWorkforceLifecycleOwner(props.schedule) ??
    validateWorkforcePeriodVersions(props.schedule) ??
    validateWorkforceEmploymentStatuses(props.schedule) ??
    validateWorkforceAssignments(props.schedule, props.organizationUnitPeriods) ??
    validateWorkforceResponsibilities([props.schedule], props.organizationUnitPeriods)
  )
}
