import { compareOrganizationalAuthorityAssignments } from "@/contexts/company/domain/policies/compare-organizational-authority-assignments.policy"
import { compareOrganizationalAuthorityManagementRelations } from "@/contexts/company/domain/policies/compare-organizational-authority-management-relations.policy"
import { compareOrganizationalAuthorityResponsibilities } from "@/contexts/company/domain/policies/compare-organizational-authority-responsibilities.policy"
import { listOrganizationalAuthorityManagementChainCandidates } from "@/contexts/company/domain/policies/list-organizational-authority-management-chain-candidates.policy"
import { listWorkforceStateAssignments } from "@/contexts/company/domain/definitions/list-workforce-state-assignments.definition"
import type { OrganizationalAuthorityCandidateEvidence } from "@/contexts/company/domain/definitions/organizational-authority-candidate-evidence.definition"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityEvidence,
  OrganizationalAuthorityProjection,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import { toOrganizationalAuthorityAssignmentEvidence } from "@/contexts/company/domain/policies/to-organizational-authority-assignment-evidence.policy"
import { toOrganizationalAuthorityResponsibilityEvidence } from "@/contexts/company/domain/policies/to-organizational-authority-responsibility-evidence.policy"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export function resolveOrganizationalAuthorityCriterion(props: {
  criterion: OrganizationalAuthorityCriterion
  statesByEmployee: ReadonlyMap<EmployeeId, WorkforceStateAt>
  managementRelations: OrganizationalAuthorityProjection["managementRelations"]
  subjectEmployeeId: EmployeeId | null
  asOf: OrganizationalAuthorityProjection["snapshot"]["asOf"]
}): ReadonlyArray<OrganizationalAuthorityCandidateEvidence> {
  if (props.criterion.kind === "employee") {
    return [
      {
        employeeId: props.criterion.employeeId,
        evidence: { kind: "employee", employeeId: props.criterion.employeeId },
      },
    ]
  }
  if (
    props.subjectEmployeeId === null &&
    props.criterion.kind !== "target_organization_manager" &&
    props.criterion.kind !== "responsibility"
  ) {
    return []
  }

  const subject =
    props.subjectEmployeeId === null
      ? undefined
      : props.statesByEmployee.get(props.subjectEmployeeId)
  const subjectAssignments =
    subject === undefined
      ? []
      : listWorkforceStateAssignments(subject).toSorted(compareOrganizationalAuthorityAssignments)

  if (props.criterion.kind === "direct_manager") {
    return props.managementRelations
      .filter((relation) => relation.employeeId === props.subjectEmployeeId)
      .toSorted(compareOrganizationalAuthorityManagementRelations)
      .map((relation) => {
        const evidence: OrganizationalAuthorityEvidence =
          "assignmentPeriodId" in relation
            ? { kind: "direct_manager", assignment: relation }
            : { kind: "direct_manager", reportingRelation: relation }
        return { employeeId: relation.managerEmployeeId, evidence }
      })
  }

  const responsibilities = [...props.statesByEmployee.values()]
    .flatMap((state) => state.responsibilities)
    .toSorted(compareOrganizationalAuthorityResponsibilities)
  if (props.criterion.kind === "subject_organization_manager") {
    return subjectAssignments.flatMap((assignment) =>
      responsibilities
        .filter(
          (responsibility) =>
            responsibility.responsibilityType === "MANAGER" &&
            responsibility.organizationUnitId === assignment.organizationUnitId,
        )
        .map(
          (responsibility): OrganizationalAuthorityCandidateEvidence => ({
            employeeId: responsibility.employeeId,
            evidence: {
              kind: "organization_manager",
              scope: "subject",
              subjectAssignment: toOrganizationalAuthorityAssignmentEvidence(
                assignment,
                props.asOf,
              ),
              responsibility: toOrganizationalAuthorityResponsibilityEvidence(
                responsibility,
                props.asOf,
              ),
            },
          }),
        ),
    )
  }
  if (props.criterion.kind === "target_organization_manager") {
    const criterion = props.criterion
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === "MANAGER" &&
          responsibility.organizationUnitId === criterion.organizationUnitId,
      )
      .map(
        (responsibility): OrganizationalAuthorityCandidateEvidence => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "organization_manager",
            scope: "target",
            subjectAssignment: null,
            responsibility: toOrganizationalAuthorityResponsibilityEvidence(
              responsibility,
              props.asOf,
            ),
          },
        }),
      )
  }
  if (props.criterion.kind === "responsibility") {
    const criterion = props.criterion
    return responsibilities
      .filter(
        (responsibility) =>
          responsibility.responsibilityType === criterion.responsibilityType &&
          (criterion.organizationUnitId === null ||
            responsibility.organizationUnitId === criterion.organizationUnitId),
      )
      .map(
        (responsibility): OrganizationalAuthorityCandidateEvidence => ({
          employeeId: responsibility.employeeId,
          evidence: {
            kind: "responsibility",
            responsibility: toOrganizationalAuthorityResponsibilityEvidence(
              responsibility,
              props.asOf,
            ),
          },
        }),
      )
  }
  if (props.subjectEmployeeId === null) return []

  return listOrganizationalAuthorityManagementChainCandidates({
    managementRelations: props.managementRelations,
    subjectEmployeeId: props.subjectEmployeeId,
  })
}
