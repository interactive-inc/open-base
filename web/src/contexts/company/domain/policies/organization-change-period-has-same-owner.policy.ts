import type { OrganizationChangeVersionedPeriod } from "@/contexts/company/domain/definitions/organization-change-versioned-period.definition"

export function organizationChangePeriodHasSameOwner(
  left: OrganizationChangeVersionedPeriod,
  right: OrganizationChangeVersionedPeriod,
): boolean {
  if ("officialName" in left || "officialName" in right) {
    return (
      "officialName" in left &&
      "officialName" in right &&
      left.organizationUnitId === right.organizationUnitId
    )
  }
  if ("assignmentType" in left || "assignmentType" in right) {
    return (
      "assignmentType" in left &&
      "assignmentType" in right &&
      left.employmentId === right.employmentId &&
      left.employeeId === right.employeeId &&
      left.organizationUnitId === right.organizationUnitId &&
      left.assignmentType === right.assignmentType
    )
  }
  return (
    left.employmentId === right.employmentId &&
    left.employeeId === right.employeeId &&
    left.organizationUnitId === right.organizationUnitId &&
    left.responsibilityType === right.responsibilityType
  )
}
