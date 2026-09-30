import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import { organizationChangePeriodHasSameOwner } from "@/contexts/company/domain/policies/organization-change-period-has-same-owner.policy"
import type { OrganizationChangeVersionedPeriod } from "@/contexts/company/domain/definitions/organization-change-versioned-period.definition"

export function replaceOrganizationChangePeriods<TPeriod extends OrganizationChangeVersionedPeriod>(
  current: ReadonlyArray<TPeriod>,
  additions: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> | OrganizationChangeValidationError {
  const latest = new Map(current.map((period) => [period.periodId, period]))
  for (const addition of additions) {
    const previous = latest.get(addition.periodId)
    if (
      addition.revision !== (previous?.revision ?? 0) + 1 ||
      (previous !== undefined && !organizationChangePeriodHasSameOwner(previous, addition))
    ) {
      return new OrganizationChangeValidationError("invalid_revision")
    }
    latest.set(addition.periodId, addition)
  }
  return [...latest.values()]
}
