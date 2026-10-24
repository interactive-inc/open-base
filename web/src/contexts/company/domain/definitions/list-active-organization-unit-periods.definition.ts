import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"

export function listActiveOrganizationUnitPeriods(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): ReadonlyArray<OrganizationUnitPeriod> {
  return periods.filter((period) => !period.isVoid)
}
