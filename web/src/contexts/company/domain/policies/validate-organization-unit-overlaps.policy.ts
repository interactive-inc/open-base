import { OrganizationInvariantViolationValue } from "@/contexts/company/domain/values/organization-invariant-violation.value"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { workforcePeriodsOverlap } from "@/contexts/company/domain/policies/workforce-periods-overlap.policy"

export function validateOrganizationUnitOverlaps(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  for (const [index, left] of periods.entries()) {
    for (const right of periods.slice(index + 1)) {
      if (!workforcePeriodsOverlap(left, right)) continue
      if (left.organizationUnitId === right.organizationUnitId) {
        return new OrganizationInvariantViolationValue(
          "organization_unit_overlap",
          "organization unit periods overlap",
        )
      }
      if (left.code === right.code) {
        return new OrganizationInvariantViolationValue(
          "organization_code_overlap",
          "organization unit codes overlap",
        )
      }
      if (left.kind === "COMPANY" && right.kind === "COMPANY") {
        return new OrganizationInvariantViolationValue(
          "organization_unit_overlap",
          "company root periods overlap",
        )
      }
    }
  }
  return null
}
