import type { OrganizationalAuthorityCriterion } from "@/contexts/company/domain/definitions/organizational-authority-candidate.definition"
import type { WorkflowApproverMatch } from "@/contexts/company/domain/definitions/company-procedure-approver.definition"
import type { WorkflowApproverSelector } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ResolveOrganizationalAuthorityCandidatesAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-organizational-authority-candidates.adapter"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

function toCompanyCriterion(selector: WorkflowApproverSelector): OrganizationalAuthorityCriterion {
  if (selector.type === "employee") {
    return { kind: "employee", employeeCode: selector.employee_code }
  }

  if (selector.type === "responsibility") {
    return {
      kind: "responsibility",
      responsibilityType: selector.responsibility_type,
      organizationUnitCode: selector.organization_unit_code,
    }
  }

  return { kind: selector.type }
}

async function resolveWorkflowApproverMatches(props: {
  c: CompanyContext
  applicantEmployeeId: EmployeeId | null
  selectors: ReadonlyArray<WorkflowApproverSelector>
  resolvedAt: string
  targetDepartmentCode?: string | null
}): Promise<ReadonlyArray<WorkflowApproverMatch> | Error> {
  const resolution = await new ResolveOrganizationalAuthorityCandidatesAdapter({
    c: props.c,
    subjectEmployeeId: props.applicantEmployeeId,
    criteria: props.selectors.map(toCompanyCriterion),
    resolvedAt: props.resolvedAt,
    targetDepartmentCode: props.targetDepartmentCode,
  }).resolveOrganizationalAuthorityCandidates()
  if (resolution instanceof Error) return resolution

  const matches: WorkflowApproverMatch[] = []
  for (const candidate of resolution.candidates) {
    const selector = props.selectors[candidate.qualification.criterionIndex]
    if (selector === undefined) {
      return new Error("Company authority resolution returned an unknown criterion")
    }
    matches.push({
      employeeId: candidate.employeeId,
      accountId: candidate.accountId,
      provenance: {
        selector_index: candidate.qualification.criterionIndex,
        selector,
        evidence: {
          ...candidate.qualification.evidence,
          authority_snapshot: {
            schema_version: resolution.snapshot.schemaVersion,
            source: resolution.snapshot.source,
            as_of: resolution.snapshot.asOf,
            organization_revision: resolution.snapshot.organizationRevision,
            ...(resolution.snapshot.companyRevision === undefined
              ? {}
              : {
                  company_revision: resolution.snapshot.companyRevision,
                }),
          },
        },
      },
    })
  }

  return matches
}
type ResolveCompanyProcedureApproverMatchesAdapterContext = {
  c: CompanyContext
  applicantEmployeeId: EmployeeId | null
  selectors: ReadonlyArray<WorkflowApproverSelector>
  resolvedAt: string
  targetDepartmentCode?: string | null
}
type Context = ResolveCompanyProcedureApproverMatchesAdapterContext

export class ResolveCompanyProcedureApproverMatchesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveWorkflowApproverMatches(): Promise<ReadonlyArray<WorkflowApproverMatch> | Error> {
    return resolveWorkflowApproverMatches(this.c)
  }
}
