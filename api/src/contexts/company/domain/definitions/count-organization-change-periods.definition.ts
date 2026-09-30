import type { OrganizationChangeSet } from "@/contexts/company/domain/definitions/organization-change.definition"

export function countOrganizationChangePeriods(change: OrganizationChangeSet): number {
  return change.unitPeriods.length + change.assignments.length + change.responsibilities.length
}
