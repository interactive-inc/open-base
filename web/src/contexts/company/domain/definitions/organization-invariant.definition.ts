import type { OrganizationInvariantViolationValue } from "@/contexts/company/domain/values/organization-invariant-violation.value"

export const organizationInvariantCodes = [
  "invalid_snapshot",
  "invalid_period",
  "duplicate_period",
  "organization_unit_overlap",
  "organization_code_overlap",
  "invalid_parent",
  "parent_not_active",
  "hierarchy_cycle",
] as const

export type OrganizationInvariantCode = (typeof organizationInvariantCodes)[number]

export type OrganizationInvariantViolation = OrganizationInvariantViolationValue
