import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import { OrganizationInvariantViolationValue } from "@/contexts/company/domain/values/organization-invariant-violation.value"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"

export function validateOrganizationUnitParents(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  for (const child of periods) {
    if (child.parentOrganizationUnitId === null) continue
    if (
      !periodsContainPeriod(
        periods.filter(
          (candidate) =>
            !candidate.isVoid && candidate.organizationUnitId === child.parentOrganizationUnitId,
        ),
        child,
      )
    ) {
      return new OrganizationInvariantViolationValue(
        "parent_not_active",
        "parent organization unit is not active for the full child period",
      )
    }
  }
  return null
}
