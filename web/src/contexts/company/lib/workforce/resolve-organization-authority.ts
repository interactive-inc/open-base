import { ReadOrganizationWorkforceState } from "@/contexts/company/lib/workforce/read-organization-workforce-state"
import type { CompanyReportingRelationsReadPort } from "@/contexts/company/domain/definitions/company-reporting-relations-read.definition"
import type { WorkforceSnapshotReadPort } from "@/contexts/company/domain/definitions/organization-change.definition"
import { type OrganizationUnitReadPort } from "@/contexts/company/domain/definitions/organization-change.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type {
  OrganizationalAuthorityCriterion,
  OrganizationalAuthorityResolution,
} from "@/contexts/company/domain/definitions/organizational-authority.definition"
import { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import { resolveOrganizationalAuthority } from "@/contexts/company/domain/policies/resolve-organizational-authority.policy"
import type { WorkforceStateResolutionError } from "@/contexts/company/domain/errors"
import { type OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type ResolveOrganizationAuthorityResult =
  | Readonly<{ kind: "resolved"; resolution: OrganizationalAuthorityResolution }>
  | Readonly<{
      kind: "invalid"
      error:
        | OrganizationInvariantViolation
        | WorkforceInvariantViolation
        | WorkforceStateResolutionError
        | OrganizationalAuthorityError
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

/** 同一organization revisionの全Workforce stateからCompany組織資格を解決する。 */
export class ResolveOrganizationAuthority {
  constructor(
    private readonly ports: Readonly<{
      organization: OrganizationUnitReadPort
      workforce: WorkforceSnapshotReadPort
      reporting: CompanyReportingRelationsReadPort
    }>,
  ) {
    Object.freeze(this)
  }

  async execute(
    props: Readonly<{
      subjectEmployeeId: EmployeeId | null
      criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
      asOf: CalendarDate
    }>,
  ): Promise<ResolveOrganizationAuthorityResult> {
    try {
      const snapshot = await new ReadOrganizationWorkforceState(this.ports).execute(props.asOf)
      if (snapshot.kind !== "found") return snapshot

      const resolution = resolveOrganizationalAuthority({
        snapshot: {
          schemaVersion: 1,
          source: "lifecycle",
          asOf: props.asOf,
          organizationRevision: snapshot.organization.revision,
          companyRevision: snapshot.companyRevision,
        },
        subjectEmployeeId: props.subjectEmployeeId,
        criteria: props.criteria,
        states: snapshot.employees,
        managementRelations: snapshot.managementRelations,
        accountLinks: snapshot.accountLinks,
      })
      return resolution instanceof OrganizationalAuthorityError
        ? { kind: "invalid", error: resolution }
        : { kind: "resolved", resolution }
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
