import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyEmployeeDirectoryEntry } from "@/contexts/company/domain/definitions/employee-directory-entry.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyConflictError, CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"

type Context = CompanyContext

/** 検証済み組織snapshotと同じ基準日・revisionの従業員情報だけを返す。 */
export class ReadCompanySnapshotEmployeesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(input: {
    employeeIds: ReadonlyArray<EmployeeId>
    asOf: CalendarDate
    organizationRevision: number
    companyRevision: number
  }): Promise<ReadonlyArray<CompanyEmployeeDirectoryEntry> | Error> {
    const employees = await new CompanyEmployeeDirectoryReadAdapter({
      env: this.c.env,
      asOf: input.asOf,
    }).findForEmployeeIds(input.employeeIds)
    if (employees instanceof Error) return employees
    const organization = await new OrganizationUnitReadAdapter(this.c.var.database).readRevision()
    const company = await new CompanyReportingRelationsReadAdapter(this.c.env.DB).readRevision()
    if (!organization.ok || !company.ok)
      return new CompanyUnavailableError(
        "Company revisionを読み出せません",
        "organization_snapshot_unavailable",
      )
    if (
      organization.revision !== input.organizationRevision ||
      company.revision !== input.companyRevision
    )
      return new CompanyConflictError(
        "組織revisionが変化したため従業員情報を固定できません",
        "organization_revision_conflict",
      )
    if (employees.length !== new Set(input.employeeIds).size)
      return new CompanyConflictError(
        "組織snapshotの従業員情報が不足しています",
        "organization_snapshot_invalid",
      )
    return employees
  }
}
