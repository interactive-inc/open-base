import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type {
  OrganizationalAuthorityCandidateResolution,
  OrganizationalAuthorityCriterion,
  OrganizationalAuthoritySnapshot,
} from "@/contexts/company/domain/definitions/organizational-authority-candidate.definition"
import { ResolveCanonicalOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/workforce/resolve-canonical-organization-authority.adapter"
import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { employees } from "@/contexts/company/infrastructure/schema/employee"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyUnavailableError,
  CompanyUnexpectedError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

async function readOrganizationRevision(
  c: CompanyContext,
): Promise<number | CompanyOperationError> {
  try {
    const revision = await c.env.DB.prepare(
      "SELECT revision FROM company_organization_lifecycle_states WHERE id = 1",
    ).first<number>("revision")

    return revision === null
      ? new CompanyUnavailableError(
          "組織 revision がありません",
          "organization_snapshot_unavailable",
        )
      : revision
  } catch (cause) {
    return new CompanyUnavailableError(
      "組織 revision を読み出せません",
      "organization_snapshot_unavailable",
      { cause },
    )
  }
}

async function resolveSnapshot(
  c: CompanyContext,
  resolvedAt: string,
): Promise<OrganizationalAuthoritySnapshot | CompanyOperationError> {
  const asOf = resolveCompanyBusinessDate({
    now: resolvedAt,
    timeZone: c.env.COMPANY_TIME_ZONE,
  })
  if (typeof asOf !== "string") {
    return new CompanyUnexpectedError("判断資格の基準日を解決できません", { cause: asOf })
  }

  const organizationRevision = await readOrganizationRevision(c)
  const companyRevision = await new CompanyReportingRelationsReadAdapter(c.env.DB).readRevision()
  if (!companyRevision.ok) {
    return new CompanyUnavailableError(
      "Company revisionを読み出せません",
      "organization_snapshot_unavailable",
      { cause: companyRevision.cause },
    )
  }
  return organizationRevision instanceof CompanyOperationError
    ? organizationRevision
    : {
        schemaVersion: 1,
        source: "lifecycle",
        asOf,
        organizationRevision,
        companyRevision: companyRevision.revision,
      }
}

function revisionConflict(): CompanyConflictError {
  return new CompanyConflictError(
    "組織 revision が変化したため判断資格を固定できません",
    "organization_revision_conflict",
  )
}

/** canonical Company組織だけから判断候補と変更不能な証拠snapshotを解決する。 */
async function resolveOrganizationalAuthorityCandidates(props: {
  c: CompanyContext
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  resolvedAt: string
  targetDepartmentCode?: string | null
}): Promise<OrganizationalAuthorityCandidateResolution | CompanyOperationError> {
  const snapshot = await resolveSnapshot(props.c, props.resolvedAt)
  if (snapshot instanceof CompanyOperationError) return snapshot

  try {
    const employeeIds = await props.c.var.database.select({ id: employees.id }).from(employees)
    const directory = await new CompanyEmployeeDirectoryReadAdapter({
      env: props.c.env,
      asOf: restoreCalendarDate(snapshot.asOf),
    }).findForEmployeeIds(employeeIds.map((employee) => employee.id))
    if (directory instanceof Error)
      return new CompanyUnavailableError(
        "従業員情報を読み出せません",
        "organization_snapshot_unavailable",
        { cause: directory },
      )
    const employeeRows = directory.map((employee) => ({
      id: employee.id,
      code: employee.employeeCode,
    }))
    const resolution = await new ResolveCanonicalOrganizationAuthorityAdapter({
      c: props.c,
      subjectEmployeeId: props.subjectEmployeeId,
      criteria: props.criteria,
      employeeRows,
      targetDepartmentCode: props.targetDepartmentCode ?? null,
      asOf: snapshot.asOf,
    }).resolveCanonicalOrganizationAuthority()
    if (resolution instanceof CompanyOperationError) return resolution

    const finalOrganizationRevision = await readOrganizationRevision(props.c)
    if (finalOrganizationRevision instanceof CompanyOperationError) return finalOrganizationRevision
    const finalCompanyRevision = await new CompanyReportingRelationsReadAdapter(
      props.c.env.DB,
    ).readRevision()
    if (!finalCompanyRevision.ok) {
      return new CompanyUnavailableError(
        "Company revisionを読み出せません",
        "organization_snapshot_unavailable",
        { cause: finalCompanyRevision.cause },
      )
    }
    if (
      snapshot.organizationRevision !== resolution.snapshot.organizationRevision ||
      finalOrganizationRevision !== resolution.snapshot.organizationRevision ||
      snapshot.companyRevision !== resolution.snapshot.companyRevision ||
      finalCompanyRevision.revision !== resolution.snapshot.companyRevision
    ) {
      return revisionConflict()
    }

    return resolution
  } catch (cause) {
    return new CompanyUnexpectedError("組織上の判断資格を解決できません", { cause })
  }
}
type ResolveOrganizationalAuthorityCandidatesAdapterContext = {
  c: CompanyContext
  subjectEmployeeId: EmployeeId | null
  criteria: ReadonlyArray<OrganizationalAuthorityCriterion>
  resolvedAt: string
  targetDepartmentCode?: string | null
}
type Context = ResolveOrganizationalAuthorityCandidatesAdapterContext

export class ResolveOrganizationalAuthorityCandidatesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveOrganizationalAuthorityCandidates(): Promise<
    OrganizationalAuthorityCandidateResolution | CompanyOperationError
  > {
    return resolveOrganizationalAuthorityCandidates(this.c)
  }
}
