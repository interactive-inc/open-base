import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function organizationUnitHierarchyHasCycleAt(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
  date: CalendarDate,
): boolean {
  const parents = new Map<OrganizationUnitId, OrganizationUnitId>()
  for (const period of periods) {
    if (periodContainsDate(period, date) && period.parentOrganizationUnitId !== null) {
      parents.set(period.organizationUnitId, period.parentOrganizationUnitId)
    }
  }

  for (const unitId of parents.keys()) {
    const path = new Set<OrganizationUnitId>()
    let current: OrganizationUnitId | undefined = unitId
    while (current !== undefined) {
      if (path.has(current)) return true
      path.add(current)
      current = parents.get(current)
    }
  }
  return false
}
