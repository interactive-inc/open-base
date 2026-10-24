import type { OrganizationalAuthorityEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"

type Context = OrganizationalAuthorityEvidence

export class CanonicalOrganizationAuthorityEvidenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  serialize(): Readonly<Record<string, unknown>> {
    const value = this.c
    if (value.kind === "employee") {
      return { type: "employee", employee_id: value.employeeId }
    }
    if (value.kind === "direct_manager") {
      if ("reportingRelation" in value) {
        return {
          type: "reporting_relation",
          employee_id: value.reportingRelation.employeeId,
          manager_employee_id: value.reportingRelation.managerEmployeeId,
          organization_unit_id: value.reportingRelation.organizationUnitId,
          reporting_relation_id: value.reportingRelation.reportingRelationId,
          reporting_relation_revision: value.reportingRelation.reportingRelationRevision,
          as_of: value.reportingRelation.asOf,
        }
      }
      return {
        type: "lifecycle_assignment",
        employee_id: value.assignment.employeeId,
        manager_employee_id: value.assignment.managerEmployeeId,
        organization_unit_id: value.assignment.organizationUnitId,
        assignment_period_id: value.assignment.assignmentPeriodId,
        assignment_revision: value.assignment.assignmentRevision,
        as_of: value.assignment.asOf,
      }
    }
    if (value.kind === "organization_manager") {
      return {
        type: "lifecycle_responsibility",
        scope: value.scope,
        subject_assignment: value.subjectAssignment,
        employee_id: value.responsibility.employeeId,
        organization_unit_id: value.responsibility.organizationUnitId,
        responsibility_period_id: value.responsibility.responsibilityPeriodId,
        responsibility_revision: value.responsibility.responsibilityRevision,
        as_of: value.responsibility.asOf,
      }
    }
    if (value.kind === "responsibility") {
      return {
        type: "responsibility",
        employee_id: value.responsibility.employeeId,
        organization_unit_id: value.responsibility.organizationUnitId,
        responsibility_type: value.responsibility.responsibilityType,
        responsibility_period_id: value.responsibility.responsibilityPeriodId,
        responsibility_revision: value.responsibility.responsibilityRevision,
        as_of: value.responsibility.asOf,
      }
    }
    return {
      type: "management_chain",
      path: value.path.map((edge) => ({
        employee_id: edge.employeeId,
        manager_employee_id: edge.managerEmployeeId,
        organization_unit_id: edge.organizationUnitId,
        ...("assignmentPeriodId" in edge
          ? {
              assignment_period_id: edge.assignmentPeriodId,
              assignment_revision: edge.assignmentRevision,
            }
          : {
              reporting_relation_id: edge.reportingRelationId,
              reporting_relation_revision: edge.reportingRelationRevision,
            }),
        as_of: edge.asOf,
      })),
    }
  }
}
