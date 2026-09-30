import type { WorkforceSnapshotReadPort } from "@/contexts/company/domain/definitions/organization-change.definition"
import { type OrganizationUnitReadPort } from "@/contexts/company/domain/definitions/organization-change.definition"
import { WorkforceSnapshotChangedError } from "@/contexts/company/domain/errors"
import type { OrganizationalAuthorityError } from "@/contexts/company/domain/errors"
import type { CompanyReportingRelationsReadPort } from "@/contexts/company/domain/definitions/company-reporting-relations-read.definition"
import type { OrganizationalAuthorityManagementEdgeEvidence } from "@/contexts/company/domain/definitions/organizational-authority.definition"
import type { AccountEmployeeLink } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { resolveWorkforceManagementRelations } from "@/contexts/company/domain/policies/resolve-workforce-management-relations.policy"
import { validateOrganizationalAuthorityProjection } from "@/contexts/company/domain/policies/validate-organizational-authority-projection.policy"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { OrganizationUnitSnapshot } from "@/contexts/company/domain/definitions/organization-unit.definition"
import {
  resolveWorkforceStateAt,
  type WorkforceStateAt,
} from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type { WorkforceStateResolutionError } from "@/contexts/company/domain/errors"
import { type OrganizationInvariantViolation } from "@/contexts/company/domain/definitions/organization-invariant.definition"
import { validateOrganizationUnitSnapshot } from "@/contexts/company/domain/policies/validate-organization-unit-snapshot.policy"
import type { WorkforceInvariantViolation } from "@/contexts/company/domain/definitions/workforce-invariant.definition"
import { validateWorkforceSchedules } from "@/contexts/company/domain/policies/validate-workforce-schedules.policy"

export type ReadOrganizationWorkforceStateResult =
  | Readonly<{
      kind: "found"
      organization: OrganizationUnitSnapshot
      employees: ReadonlyArray<WorkforceStateAt>
      managementRelations: ReadonlyArray<OrganizationalAuthorityManagementEdgeEvidence>
      accountLinks: ReadonlyArray<AccountEmployeeLink>
      companyRevision: number
    }>
  | Readonly<{
      kind: "invalid"
      error:
        | OrganizationInvariantViolation
        | WorkforceInvariantViolation
        | WorkforceStateResolutionError
        | OrganizationalAuthorityError
    }>
  | Readonly<{ kind: "unavailable"; cause: unknown }>

type Props = Readonly<{
  organization: OrganizationUnitReadPort
  workforce: WorkforceSnapshotReadPort
  reporting: CompanyReportingRelationsReadPort
}>

/** 同一revisionのOrgUnit、Assignment、Responsibilityを一つの時点snapshotとして読む。 */
export class ReadOrganizationWorkforceState {
  constructor(private readonly props: Props) {
    Object.freeze(this)
  }

  async execute(asOf: CalendarDate): Promise<ReadOrganizationWorkforceStateResult> {
    try {
      const reporting = await this.props.reporting.readSnapshot(asOf)
      if (!reporting.ok) return { kind: "unavailable", cause: reporting.cause }
      const organization = await this.props.organization.readSnapshot(asOf)
      if (!organization.ok) return { kind: "unavailable", cause: organization.cause }
      const organizationError = validateOrganizationUnitSnapshot(organization.snapshot)
      if (organizationError !== null) return { kind: "invalid", error: organizationError }

      const workforce = await this.props.workforce.readAllSnapshot(asOf)
      if (!workforce.ok) return { kind: "unavailable", cause: workforce.cause }
      const workforceError = validateWorkforceSchedules({
        schedules: workforce.schedules,
        organizationUnitPeriods: organization.snapshot.units,
      })
      if (workforceError !== null) return { kind: "invalid", error: workforceError }

      const employees: WorkforceStateAt[] = []
      for (const schedule of workforce.schedules) {
        const employee = resolveWorkforceStateAt(
          {
            employeeId: schedule.employee.id,
            baselineState: schedule.baselineState,
            employments: schedule.employments,
            statuses: schedule.statuses,
            assignments: schedule.assignments,
            responsibilities: schedule.responsibilities,
          },
          asOf,
        )
        if (employee instanceof Error) return { kind: "invalid", error: employee }
        employees.push(employee)
      }

      const revision = await this.props.organization.readRevision()
      if (!revision.ok) return { kind: "unavailable", cause: revision.cause }
      const companyRevision = await this.props.reporting.readRevision()
      if (!companyRevision.ok) return { kind: "unavailable", cause: companyRevision.cause }
      if (
        revision.revision !== organization.snapshot.revision ||
        companyRevision.revision !== reporting.companyRevision
      ) {
        return { kind: "unavailable", cause: new WorkforceSnapshotChangedError() }
      }

      const managementRelations = resolveWorkforceManagementRelations({
        states: employees,
        reportingRelations: reporting.relations,
      })
      if (managementRelations instanceof Error)
        return { kind: "invalid", error: managementRelations }
      const accountLinks = workforce.schedules.flatMap((schedule) =>
        schedule.accountLink === null ? [] : [schedule.accountLink],
      )
      const authorityError = validateOrganizationalAuthorityProjection({
        snapshot: {
          schemaVersion: 1,
          source: "lifecycle",
          asOf,
          organizationRevision: organization.snapshot.revision,
          companyRevision: reporting.companyRevision,
        },
        subjectEmployeeId: null,
        criteria: [],
        states: employees,
        managementRelations,
        accountLinks,
      })
      if (authorityError !== null) return { kind: "invalid", error: authorityError }
      return {
        kind: "found",
        organization: organization.snapshot,
        employees,
        managementRelations,
        accountLinks,
        companyRevision: reporting.companyRevision,
      }
    } catch (cause) {
      return { kind: "unavailable", cause }
    }
  }
}
