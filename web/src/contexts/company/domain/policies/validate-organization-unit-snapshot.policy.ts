import { OrganizationInvariantViolationValue } from "@/contexts/company/domain/values/organization-invariant-violation.value"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { listActiveOrganizationUnitPeriods } from "@/contexts/company/domain/definitions/list-active-organization-unit-periods.definition"
import { listOrganizationUnitBoundaryDates } from "@/contexts/company/domain/definitions/list-organization-unit-boundary-dates.definition"
import { organizationUnitHierarchyHasCycleAt } from "@/contexts/company/domain/policies/organization-unit-hierarchy-has-cycle-at.policy"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import type { OrganizationUnitSnapshot } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { validateOrganizationUnitOverlaps } from "@/contexts/company/domain/policies/validate-organization-unit-overlaps.policy"
import { validateOrganizationUnitParents } from "@/contexts/company/domain/policies/validate-organization-unit-parents.policy"
import { validateOrganizationUnitPeriods } from "@/contexts/company/domain/policies/validate-organization-unit-periods.policy"

/** OrgUnitの最新revision projectionを全期間についてfail closedで検証する。 */
export function validateOrganizationUnitSnapshot(
  snapshot: OrganizationUnitSnapshot,
): OrganizationInvariantViolation | null {
  if (
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    !isCalendarDate(snapshot.asOf)
  ) {
    return new OrganizationInvariantViolationValue(
      "invalid_snapshot",
      "organization snapshot is not canonical",
    )
  }

  const periods = listActiveOrganizationUnitPeriods(snapshot.units)
  return (
    validateOrganizationUnitPeriods(snapshot.units) ??
    validateOrganizationUnitOverlaps(periods) ??
    validateOrganizationUnitParents(periods) ??
    (listOrganizationUnitBoundaryDates(periods).some((date) =>
      organizationUnitHierarchyHasCycleAt(periods, date),
    )
      ? new OrganizationInvariantViolationValue(
          "hierarchy_cycle",
          "organization hierarchy contains a cycle",
        )
      : null)
  )
}
