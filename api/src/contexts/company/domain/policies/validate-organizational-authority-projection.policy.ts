import { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import { isCanonicalWorkforcePeriod } from "@/contexts/company/domain/definitions/is-canonical-workforce-period.definition"
import { isOrgResponsibilityType } from "@/contexts/company/domain/definitions/is-org-responsibility-type.definition"
import { isOrganizationalAuthorityStateEligible } from "@/contexts/company/domain/policies/is-organizational-authority-state-eligible.policy"
import { listWorkforceStateAssignments } from "@/contexts/company/domain/definitions/list-workforce-state-assignments.definition"
import type { OrganizationalAuthorityProjection } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { hasManagementCycle } from "@/contexts/company/domain/definitions/has-management-cycle.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function validateOrganizationalAuthorityProjection(
  projection: OrganizationalAuthorityProjection,
): OrganizationalAuthorityError | null {
  const revision = projection.snapshot.organizationRevision
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    (projection.snapshot.companyRevision !== undefined &&
      (!Number.isSafeInteger(projection.snapshot.companyRevision) ||
        projection.snapshot.companyRevision < 0)) ||
    (projection.managementRelations.some((relation) => "reportingRelationId" in relation) &&
      projection.snapshot.companyRevision === undefined) ||
    !isCalendarDate(projection.snapshot.asOf)
  ) {
    return new OrganizationalAuthorityError("organizational_authority_snapshot_invalid")
  }

  const statesByEmployee = new Map<EmployeeId, WorkforceStateAt>()
  const periodIds = new Set<string>()
  for (const state of projection.states) {
    if (statesByEmployee.has(state.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_employee_duplicate")
    }
    statesByEmployee.set(state.employeeId, state)

    if (state.asOf !== projection.snapshot.asOf) {
      return new OrganizationalAuthorityError("organizational_authority_state_as_of_mismatch")
    }
    const hasEligibleStatus = state.status === "ACTIVE" || state.status === "ON_LEAVE"
    if (
      hasEligibleStatus !== (state.employmentId !== null) ||
      (!isOrganizationalAuthorityStateEligible(state) &&
        (state.primaryAssignment !== null ||
          state.concurrentAssignments.length > 0 ||
          state.responsibilities.length > 0))
    ) {
      return new OrganizationalAuthorityError("organizational_authority_state_invalid")
    }

    for (const assignment of listWorkforceStateAssignments(state)) {
      if (
        state.employmentId === null ||
        assignment.employeeId !== state.employeeId ||
        assignment.employmentId !== state.employmentId ||
        !isCanonicalWorkforcePeriod(assignment) ||
        assignment.isVoid ||
        !periodContainsDate(assignment, projection.snapshot.asOf) ||
        (assignment === state.primaryAssignment && assignment.assignmentType !== "PRIMARY") ||
        (assignment !== state.primaryAssignment && assignment.assignmentType !== "CONCURRENT")
      ) {
        return new OrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      if (periodIds.has(assignment.periodId)) {
        return new OrganizationalAuthorityError("organizational_authority_period_duplicate")
      }
      periodIds.add(assignment.periodId)
    }

    for (const responsibility of state.responsibilities) {
      if (
        state.employmentId === null ||
        responsibility.employeeId !== state.employeeId ||
        responsibility.employmentId !== state.employmentId ||
        !isOrgResponsibilityType(responsibility.responsibilityType) ||
        !isCanonicalWorkforcePeriod(responsibility) ||
        responsibility.isVoid ||
        !periodContainsDate(responsibility, projection.snapshot.asOf) ||
        !listWorkforceStateAssignments(state).some(
          (assignment) => assignment.organizationUnitId === responsibility.organizationUnitId,
        )
      ) {
        return new OrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      if (periodIds.has(responsibility.periodId)) {
        return new OrganizationalAuthorityError("organizational_authority_period_duplicate")
      }
      periodIds.add(responsibility.periodId)
    }
  }

  if (
    projection.subjectEmployeeId !== null &&
    !statesByEmployee.has(projection.subjectEmployeeId)
  ) {
    return new OrganizationalAuthorityError("organizational_authority_subject_missing")
  }
  for (const criterion of projection.criteria) {
    if (criterion.kind === "employee" && !statesByEmployee.has(criterion.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_employee_reference_missing")
    }
    if (
      criterion.kind === "responsibility" &&
      !isOrgResponsibilityType(criterion.responsibilityType)
    ) {
      return new OrganizationalAuthorityError("organizational_authority_period_invalid")
    }
  }
  const relationSources = new Set<string>()
  const managersByEmployee = new Map<EmployeeId, EmployeeId[]>()
  for (const relation of projection.managementRelations) {
    if (relation.asOf !== projection.snapshot.asOf) {
      return new OrganizationalAuthorityError("organizational_authority_state_as_of_mismatch")
    }
    const employee = statesByEmployee.get(relation.employeeId)
    const manager = statesByEmployee.get(relation.managerEmployeeId)
    if (employee === undefined || manager === undefined) {
      return new OrganizationalAuthorityError("organizational_authority_employee_reference_missing")
    }
    if (
      !isOrganizationalAuthorityStateEligible(employee) ||
      !isOrganizationalAuthorityStateEligible(manager)
    ) {
      return new OrganizationalAuthorityError("organizational_authority_state_invalid")
    }
    let source: string
    if ("assignmentPeriodId" in relation) {
      if (
        !listWorkforceStateAssignments(employee).some(
          (assignment) =>
            assignment.periodId === relation.assignmentPeriodId &&
            assignment.revision === relation.assignmentRevision &&
            assignment.managerEmployeeId === relation.managerEmployeeId &&
            assignment.organizationUnitId === relation.organizationUnitId,
        )
      ) {
        return new OrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      source = `assignment:${relation.assignmentPeriodId}`
    } else {
      if (
        relation.reportingRelationId.trim().length === 0 ||
        !Number.isSafeInteger(relation.reportingRelationRevision) ||
        relation.reportingRelationRevision < 1 ||
        relation.organizationUnitId.trim().length === 0
      ) {
        return new OrganizationalAuthorityError("organizational_authority_period_invalid")
      }
      source = `reporting-relation:${relation.reportingRelationId}`
    }
    if (relationSources.has(source)) {
      return new OrganizationalAuthorityError("organizational_authority_period_duplicate")
    }
    relationSources.add(source)
    const managers = managersByEmployee.get(relation.employeeId)
    if (managers === undefined) {
      managersByEmployee.set(relation.employeeId, [relation.managerEmployeeId])
    } else {
      managers.push(relation.managerEmployeeId)
    }
  }

  const linkedEmployees = new Set<EmployeeId>()
  const linkedAccounts = new Set<string>()
  for (const link of projection.accountLinks) {
    if (!statesByEmployee.has(link.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_account_employee_missing")
    }
    if (linkedEmployees.has(link.employeeId)) {
      return new OrganizationalAuthorityError("organizational_authority_account_employee_duplicate")
    }
    if (linkedAccounts.has(link.accountId)) {
      return new OrganizationalAuthorityError("organizational_authority_account_duplicate")
    }
    linkedEmployees.add(link.employeeId)
    linkedAccounts.add(link.accountId)
  }

  return hasManagementCycle(managersByEmployee)
    ? new OrganizationalAuthorityError("organizational_authority_manager_cycle")
    : null
}
