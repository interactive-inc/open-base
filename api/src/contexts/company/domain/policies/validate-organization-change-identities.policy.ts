import type { OrganizationChangeSet } from "@/contexts/company/domain/definitions/organization-change.definition"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import type { OrganizationUnitId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function validateOrganizationChangeIdentities(
  currentPeriods: ReadonlyArray<OrganizationUnitPeriod>,
  change: OrganizationChangeSet,
): OrganizationChangeValidationError | null {
  const currentUnitIds = new Set(currentPeriods.map((period) => period.organizationUnitId))
  const newUnitIds = new Set<OrganizationUnitId>()
  for (const identity of change.organizationUnits) {
    if (
      currentUnitIds.has(identity.id) ||
      newUnitIds.has(identity.id) ||
      !Number.isSafeInteger(identity.createdAt) ||
      identity.createdAt < 0
    ) {
      return new OrganizationChangeValidationError("invalid_identity")
    }
    newUnitIds.add(identity.id)
  }
  if (
    change.unitPeriods.some(
      (period) =>
        !currentUnitIds.has(period.organizationUnitId) &&
        !newUnitIds.has(period.organizationUnitId),
    ) ||
    [...newUnitIds].some(
      (unitId) => !change.unitPeriods.some((period) => period.organizationUnitId === unitId),
    )
  ) {
    return new OrganizationChangeValidationError("invalid_identity")
  }
  return null
}
