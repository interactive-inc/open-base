import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import type { WorkforceInvariantViolationValue } from "@/contexts/company/domain/values/workforce-invariant-violation.value"
import type {
  WorkforceLifecycleSchedule,
  WorkforceSchedule,
} from "@/contexts/company/domain/definitions/workforce-schedule.definition"

export const workforceInvariantCodes = [
  "invalid_employee",
  "invalid_period",
  "duplicate_period",
  "employee_mismatch",
  "employment_overlap",
  "status_outside_employment",
  "status_gap_or_overlap",
  "assignment_outside_employment",
  "inactive_organization_unit",
  "primary_assignment_overlap",
  "assignment_overlap",
  "self_manager",
  "responsibility_outside_employment",
  "invalid_responsibility",
  "responsibility_without_assignment",
  "responsibility_overlap",
  "manager_not_active",
  "manager_cycle",
  "account_link_mismatch",
  "duplicate_account_link",
] as const

export type WorkforceInvariantCode = (typeof workforceInvariantCodes)[number]

export type WorkforceInvariantViolation = WorkforceInvariantViolationValue

export type ValidateWorkforceSchedulesProps = Readonly<{
  schedules: ReadonlyArray<WorkforceSchedule>
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>
}>

export type ValidateWorkforceLifecycleSchedulesProps = Readonly<{
  schedules: ReadonlyArray<WorkforceLifecycleSchedule>
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>
}>

export type ValidateWorkforceLifecycleScheduleProps = Readonly<{
  schedule: WorkforceLifecycleSchedule
  organizationUnitPeriods: ReadonlyArray<OrganizationUnitPeriod>
}>
