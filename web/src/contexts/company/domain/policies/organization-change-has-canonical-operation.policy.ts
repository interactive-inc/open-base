import type { OrganizationChangeSet } from "@/contexts/company/domain/definitions/organization-change.definition"

export function organizationChangeHasCanonicalOperation(change: OrganizationChangeSet): boolean {
  return (
    Number.isSafeInteger(change.expectedRevision) &&
    change.expectedRevision >= 0 &&
    Number.isSafeInteger(change.recordedAt) &&
    change.recordedAt >= 0 &&
    [...change.unitPeriods, ...change.assignments, ...change.responsibilities].every(
      (period) =>
        period.recordedByActionId === change.operationId && period.recordedAt === change.recordedAt,
    )
  )
}
