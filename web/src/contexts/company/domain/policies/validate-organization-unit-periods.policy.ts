import { OrganizationInvariantViolationValue } from "@/contexts/company/domain/values/organization-invariant-violation.value"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { isValidOrganizationUnitText } from "@/contexts/company/domain/definitions/is-valid-organization-unit-text.definition"
import type { OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import {
  organizationUnitKinds,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/definitions/organization-unit.definition"

export function validateOrganizationUnitPeriods(
  periods: ReadonlyArray<OrganizationUnitPeriod>,
): OrganizationInvariantViolation | null {
  const periodIds = new Set<string>()

  for (const period of periods) {
    if (
      !Number.isSafeInteger(period.revision) ||
      period.revision < 1 ||
      !Number.isSafeInteger(period.recordedAt) ||
      period.recordedAt < 0 ||
      !isCalendarDate(period.startsOn) ||
      (period.endsOn !== null &&
        (!isCalendarDate(period.endsOn) || period.startsOn >= period.endsOn)) ||
      !isValidOrganizationUnitText(period.code, 64) ||
      !isValidOrganizationUnitText(period.officialName, 200) ||
      !organizationUnitKinds.includes(period.kind)
    ) {
      return new OrganizationInvariantViolationValue(
        "invalid_period",
        "organization unit period is not canonical",
      )
    }
    if (periodIds.has(period.periodId)) {
      return new OrganizationInvariantViolationValue(
        "duplicate_period",
        "organization snapshot contains more than one latest period version",
      )
    }
    periodIds.add(period.periodId)

    const parentIsValid =
      period.kind === "COMPANY"
        ? period.parentOrganizationUnitId === null
        : period.parentOrganizationUnitId !== null &&
          period.parentOrganizationUnitId !== period.organizationUnitId
    if (!parentIsValid) {
      return new OrganizationInvariantViolationValue(
        "invalid_parent",
        "organization unit has an invalid parent",
      )
    }
  }
  return null
}
