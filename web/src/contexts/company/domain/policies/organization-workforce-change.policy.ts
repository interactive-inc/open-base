import { OrganizationWorkforceChangeEntity } from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import {
  OrganizationStructureValue,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/values/organization-structure.value"
import {
  WorkforceScheduleEntity,
  type OrgAssignmentPeriod,
  type OrgResponsibilityPeriod,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import { validateWorkforceOrganization } from "@/contexts/company/domain/policies/workforce-organization.policy"

type ChangePeriod = OrganizationUnitPeriod | OrgAssignmentPeriod | OrgResponsibilityPeriod

function hasSameOwner(left: ChangePeriod, right: ChangePeriod): boolean {
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

function replacePeriods<TPeriod extends ChangePeriod>(
  current: ReadonlyArray<TPeriod>,
  additions: ReadonlyArray<TPeriod>,
): ReadonlyArray<TPeriod> | OrganizationChangeValidationError {
  const latest = new Map(current.map((period) => [period.periodId, period]))
  for (const addition of additions) {
    const previous = latest.get(addition.periodId)
    if (
      addition.revision !== (previous?.revision ?? 0) + 1 ||
      (previous !== undefined && !hasSameOwner(previous, addition))
    ) {
      return new OrganizationChangeValidationError("invalid_revision")
    }
    latest.set(addition.periodId, addition)
  }
  return [...latest.values()]
}

function includesOrganizationIdentities(
  organization: OrganizationStructureValue,
  change: OrganizationWorkforceChangeEntity,
): boolean {
  const currentIds = new Set(organization.units.map((period) => period.organizationUnitId))
  const newIds = new Set(change.organizationUnits.map((identity) => identity.id))
  return (
    !change.organizationUnits.some((identity) => currentIds.has(identity.id)) &&
    !change.unitPeriods.some(
      (period) =>
        !currentIds.has(period.organizationUnitId) && !newIds.has(period.organizationUnitId),
    ) &&
    ![...newIds].some(
      (unitId) => !change.unitPeriods.some((period) => period.organizationUnitId === unitId),
    )
  )
}

function updateSchedules(
  schedules: ReadonlyArray<WorkforceScheduleEntity>,
  change: OrganizationWorkforceChangeEntity,
): ReadonlyArray<WorkforceScheduleEntity> | OrganizationChangeValidationError {
  const knownEmployeeIds = new Set(schedules.map((schedule) => schedule.employeeId))
  if (
    [...change.assignments, ...change.responsibilities].some(
      (period) => !knownEmployeeIds.has(period.employeeId),
    )
  ) {
    return new OrganizationChangeValidationError("unknown_employee")
  }

  const result: WorkforceScheduleEntity[] = []
  for (const schedule of schedules) {
    const assignments = replacePeriods(
      schedule.assignments,
      change.assignments.filter((period) => period.employeeId === schedule.employeeId),
    )
    if (assignments instanceof OrganizationChangeValidationError) return assignments
    const responsibilities = replacePeriods(
      schedule.responsibilities,
      change.responsibilities.filter((period) => period.employeeId === schedule.employeeId),
    )
    if (responsibilities instanceof OrganizationChangeValidationError) return responsibilities
    const updated = schedule.withOrganizationPeriods({ assignments, responsibilities })
    if (!(updated instanceof WorkforceScheduleEntity)) {
      return new OrganizationChangeValidationError("invalid_workforce")
    }
    result.push(updated)
  }
  return result
}

export type AppliedOrganizationWorkforceChange = Readonly<{
  organization: OrganizationStructureValue
  schedules: ReadonlyArray<WorkforceScheduleEntity>
}>

/** Change、組織構造、全Employee scheduleを横断して変更後snapshotを確定する。 */
export function applyOrganizationWorkforceChange(
  change: OrganizationWorkforceChangeEntity,
  organization: OrganizationStructureValue,
  schedules: ReadonlyArray<WorkforceScheduleEntity>,
): AppliedOrganizationWorkforceChange | OrganizationChangeValidationError {
  if (!includesOrganizationIdentities(organization, change)) {
    return new OrganizationChangeValidationError("invalid_identity")
  }
  const units = replacePeriods(organization.units, change.unitPeriods)
  if (units instanceof OrganizationChangeValidationError) return units
  const nextOrganization = OrganizationStructureValue.restore({
    revision: change.expectedRevision + change.periodCount,
    asOf: change.asOf,
    units,
  })
  if (!(nextOrganization instanceof OrganizationStructureValue)) {
    return new OrganizationChangeValidationError("invalid_organization")
  }
  const nextSchedules = updateSchedules(schedules, change)
  if (nextSchedules instanceof OrganizationChangeValidationError) return nextSchedules
  if (
    validateWorkforceOrganization({
      schedules: nextSchedules,
      organization: nextOrganization,
    }) !== null
  ) {
    return new OrganizationChangeValidationError("invalid_workforce")
  }
  return Object.freeze({ organization: nextOrganization, schedules: nextSchedules })
}
