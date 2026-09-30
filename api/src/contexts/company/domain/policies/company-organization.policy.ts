import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { OrganizationStructureValue } from "@/contexts/company/domain/values/organization-structure.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { orgAssignmentTypes } from "@/contexts/company/domain/definitions/org-assignment-type.definition"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

function hasContainingOrganizationUnit(
  resource: CompanyResourceEntity,
  organizationUnitId: string,
  activeUnits: ReadonlyArray<CompanyResourceEntity>,
): boolean {
  return periodsContainPeriod(
    activeUnits
      .filter((unit) => unit.readText("organizationUnitId") === organizationUnitId)
      .map((unit) => ({ startsOn: unit.effectiveFrom, endsOn: unit.effectiveTo })),
    { startsOn: resource.effectiveFrom, endsOn: resource.effectiveTo },
  )
}

function hasContainingResource(
  resource: CompanyResourceEntity,
  type: CompanyResourceType,
  id: string,
  resources: ReadonlyArray<CompanyResourceEntity>,
): boolean {
  return resources.some(
    (candidate) =>
      candidate.type === type &&
      candidate.id === id &&
      candidate.state === "active" &&
      candidate.containsPeriod(resource),
  )
}

function activeResourcesOfType(
  resources: ReadonlyArray<CompanyResourceEntity>,
  type: CompanyResourceType,
): ReadonlyArray<CompanyResourceEntity> {
  return resources.filter((resource) => resource.type === type && resource.state === "active")
}

/** Generic Company resourcesの変更後全体を、組織・配属・指揮命令・権限の横断規則で検証する。 */
export function validateCompanyOrganizationChange(
  currentResources: ReadonlyArray<CompanyResourceEntity>,
  change: CompanyResourceChangeEntity,
  reportingHistory: ReadonlyArray<CompanyResourceEntity>,
): CompanyResourceValidationError | null {
  const merged = new Map(
    currentResources.map((resource) => [`${resource.type}\u0000${resource.id}`, resource]),
  )
  for (const resource of change.resources) {
    merged.set(`${resource.type}\u0000${resource.id}`, resource)
  }
  const resources = [...merged.values()]
  const organizationUnitResources = resources.filter(
    (resource) => resource.type === "organization-unit",
  )
  const units = organizationUnitResources.map((resource) => resource.toOrganizationUnitPeriod())
  if (units.some((unit) => unit === null)) {
    return new CompanyResourceValidationError("invalid_organization")
  }
  const structure = OrganizationStructureValue.restore({
    revision: change.expectedRevision + 1,
    asOf: restoreCalendarDate("1970-01-01"),
    units: units.filter((unit) => unit !== null),
  })
  if (!(structure instanceof OrganizationStructureValue)) {
    return new CompanyResourceValidationError("invalid_organization")
  }

  const activeUnits = organizationUnitResources.filter((resource) => resource.state === "active")
  const assignments = resources.filter(
    (resource) => resource.type === "assignment" && resource.state === "active",
  )
  for (const assignment of assignments) {
    const employeeId = assignment.readText("employeeId")
    const employmentId = assignment.readText("employmentId")
    const organizationUnitId = assignment.readText("organizationUnitId")
    const assignmentType = assignment.readText("assignmentType")
    if (
      employeeId === null ||
      employmentId === null ||
      organizationUnitId === null ||
      assignmentType === null ||
      !orgAssignmentTypes.includes(assignmentType as (typeof orgAssignmentTypes)[number]) ||
      !hasContainingOrganizationUnit(assignment, organizationUnitId, activeUnits)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    if (
      assignmentType === "PRIMARY" &&
      assignments.some(
        (candidate) =>
          candidate.id !== assignment.id &&
          candidate.readText("employeeId") === employeeId &&
          candidate.readText("assignmentType") === "PRIMARY" &&
          candidate.overlaps(assignment),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  for (const relation of resources.filter(
    (resource) => resource.type === "reporting-relation" && resource.state === "active",
  )) {
    const employeeId = relation.readText("employeeId")
    const managerEmployeeId = relation.readText("managerEmployeeId")
    const organizationUnitId = relation.readText("organizationUnitId")
    if (
      employeeId === null ||
      managerEmployeeId === null ||
      organizationUnitId === null ||
      employeeId === managerEmployeeId ||
      !hasContainingOrganizationUnit(relation, organizationUnitId, activeUnits)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }
  const reportingTimeline = CompanyReportingRelationTimelineValue.create([
    ...reportingHistory,
    ...change.resources.filter((resource) => resource.type === "reporting-relation"),
  ])
  if (reportingTimeline instanceof Error || reportingTimeline.hasManagementCycle()) {
    return new CompanyResourceValidationError("invalid_organization")
  }

  for (const office of activeResourcesOfType(resources, "organizational-office")) {
    const organizationUnitId = office.readText("organizationUnitId")
    const positionId = office.readText("positionId")
    if (
      organizationUnitId === null ||
      positionId === null ||
      !hasContainingOrganizationUnit(office, organizationUnitId, activeUnits) ||
      !hasContainingResource(office, "position", positionId, resources)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  const officeAssignments = activeResourcesOfType(resources, "office-assignment")
  for (const assignment of officeAssignments) {
    const employeeId = assignment.readText("employeeId")
    const employmentId = assignment.readText("employmentId")
    const officeId = assignment.readText("organizationalOfficeId")
    if (
      employeeId === null ||
      employmentId === null ||
      officeId === null ||
      !hasContainingResource(assignment, "employee", employeeId, resources) ||
      !hasContainingResource(assignment, "employment", employmentId, resources) ||
      !hasContainingResource(assignment, "organizational-office", officeId, resources)
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    if (
      officeAssignments.some(
        (candidate) =>
          candidate.id !== assignment.id &&
          candidate.readText("organizationalOfficeId") === officeId &&
          candidate.overlaps(assignment),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  for (const scope of activeResourcesOfType(resources, "authority-scope")) {
    const scopeType = scope.readText("scopeType")
    if (
      scopeType === "organization-unit" ||
      scopeType === "legal-entity" ||
      scopeType === "site" ||
      scopeType === "workplace"
    ) {
      const scopeId = scope.readText("scopeId")
      const contained =
        scopeId !== null &&
        (scopeType === "organization-unit"
          ? hasContainingOrganizationUnit(scope, scopeId, activeUnits)
          : hasContainingResource(scope, scopeType, scopeId, resources))
      if (!contained) {
        return new CompanyResourceValidationError("invalid_organization")
      }
    }
  }

  const responsibilityAssignments = activeResourcesOfType(resources, "responsibility-assignment")
  for (const assignment of responsibilityAssignments) {
    const responsibilityId = assignment.readText("responsibilityId")
    const holderType = assignment.readText("holderType")
    const holderId = assignment.readText("holderId")
    const authorityScopeId = assignment.readNullableText("authorityScopeId")
    const holderResourceType =
      holderType === "employee"
        ? "employee"
        : holderType === "organizational-office"
          ? "organizational-office"
          : holderType === "collective-body"
            ? "collective-body"
            : null
    if (
      responsibilityId === null ||
      holderId === null ||
      holderResourceType === null ||
      authorityScopeId === undefined ||
      !hasContainingResource(assignment, "responsibility", responsibilityId, resources) ||
      !hasContainingResource(assignment, holderResourceType, holderId, resources) ||
      (authorityScopeId !== null &&
        !hasContainingResource(assignment, "authority-scope", authorityScopeId, resources))
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
    if (
      responsibilityAssignments.some(
        (candidate) =>
          candidate.id !== assignment.id &&
          candidate.readText("responsibilityId") === responsibilityId &&
          candidate.readText("holderType") === holderType &&
          candidate.readText("holderId") === holderId &&
          candidate.readNullableText("authorityScopeId") === authorityScopeId &&
          candidate.overlaps(assignment),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  const memberships = activeResourcesOfType(resources, "collective-body-membership")
  for (const membership of memberships) {
    const collectiveBodyId = membership.readText("collectiveBodyId")
    const employeeId = membership.readText("employeeId")
    if (
      collectiveBodyId === null ||
      employeeId === null ||
      !hasContainingResource(membership, "collective-body", collectiveBodyId, resources) ||
      !hasContainingResource(membership, "employee", employeeId, resources) ||
      memberships.some(
        (candidate) =>
          candidate.id !== membership.id &&
          candidate.readText("collectiveBodyId") === collectiveBodyId &&
          candidate.readText("employeeId") === employeeId &&
          candidate.overlaps(membership),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  for (const authority of resources.filter(
    (resource) => resource.type === "organizational-authority" && resource.state === "active",
  )) {
    const employeeId = authority.readText("employeeId")
    const employmentId = authority.readText("employmentId")
    const scopeType = authority.readText("scopeType")
    const scopeId = authority.readText("scopeId")
    const authorityType = authority.readText("authority")
    if (
      employeeId === null ||
      employmentId === null ||
      (scopeType !== "organization-unit" && scopeType !== "authority-scope") ||
      scopeId === null ||
      authorityType === null ||
      (scopeType === "organization-unit"
        ? !hasContainingOrganizationUnit(authority, scopeId, activeUnits)
        : !hasContainingResource(authority, "authority-scope", scopeId, resources)) ||
      !assignments.some(
        (assignment) =>
          assignment.readText("employeeId") === employeeId &&
          assignment.readText("employmentId") === employmentId &&
          (scopeType !== "organization-unit" ||
            assignment.readText("organizationUnitId") === scopeId) &&
          assignment.containsPeriod(authority),
      )
    ) {
      return new CompanyResourceValidationError("invalid_organization")
    }
  }

  return null
}
