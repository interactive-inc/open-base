import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"

export function listOrganizationUnitBoundaryDates(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): ReadonlyArray<CalendarDate> {
  return [
    ...new Set(
      periods.flatMap((period) => [
        period.startsOn,
        ...(period.endsOn === null ? [] : [period.endsOn]),
      ]),
    ),
  ].sort()
}
