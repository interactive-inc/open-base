import type { OrganizationStructureValue } from "@/contexts/company/domain/values/organization-structure.value"
import type { WorkforceScheduleEntity } from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"

/** 一人のWorkforce scheduleが参照する組織単位の全期間が組織構造に含まれるか検証する。 */
export function validateWorkforceOrganizationUnit(
  schedule: WorkforceScheduleEntity,
  organization: OrganizationStructureValue,
): WorkforceInvariantViolation | null {
  for (const assignment of schedule.assignments) {
    if (
      !assignment.isVoid &&
      !organization.containsUnitForPeriod(assignment.organizationUnitId, assignment)
    ) {
      return Object.freeze({
        code: "inactive_organization_unit",
        message: "assignment uses an inactive organization unit",
      })
    }
  }
  for (const responsibility of schedule.responsibilities) {
    if (
      !responsibility.isVoid &&
      !organization.containsUnitForPeriod(responsibility.organizationUnitId, responsibility)
    ) {
      return Object.freeze({
        code: "inactive_organization_unit",
        message: "responsibility uses an inactive organization unit",
      })
    }
  }
  return null
}
