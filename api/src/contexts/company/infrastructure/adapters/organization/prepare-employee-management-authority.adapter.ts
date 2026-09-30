import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { ResolveCanonicalOrganizationAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/workforce/resolve-canonical-organization-authority.adapter"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = CompanyContext

/** 現在の従業員対応と管理関係を確認し、判断保存までの変更を検知する。 */
export class PrepareEmployeeManagementAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      accountId: AccountId
      actorEmployeeId: EmployeeId
      subjectEmployeeId: EmployeeId
    }>,
  ) {
    const now = this.c.env.NOW ?? new Date().toISOString()
    const asOf = resolveCompanyBusinessDate({ now, timeZone: this.c.env.COMPANY_TIME_ZONE })
    if (asOf instanceof Error) return asOf
    if (input.actorEmployeeId === input.subjectEmployeeId) return null

    const guard = await new CompanyAuthoritySnapshotGuardAdapter({
      database: this.c.env.DB,
    }).prepare({ accountIds: [input.accountId], employeeCodes: [] })
    if (guard instanceof Error) return guard

    const context = { var: this.c.var, env: { ...this.c.env, NOW: now } }
    const directory = new CompanyEmployeeDirectoryReadAdapter(context)
    const actors = await directory.findForAccountIds([input.accountId])
    if (actors instanceof Error) return actors
    const actor = actors[0]?.employee
    if (actor?.id !== input.actorEmployeeId || actor.employment?.status !== "ACTIVE") return null

    const subject = await directory.findById(input.subjectEmployeeId)
    if (subject instanceof Error) return subject
    if (
      subject === null ||
      (subject.employment?.status !== "ACTIVE" && subject.employment?.status !== "ON_LEAVE")
    )
      return null

    const authority = await new ResolveCanonicalOrganizationAuthorityAdapter({
      c: context,
      subjectEmployeeId: subject.id,
      criteria: [{ kind: "management_chain" }, { kind: "department_manager" }],
      employeeRows: [],
      targetDepartmentCode: null,
      asOf,
    }).resolveCanonicalOrganizationAuthority()
    if (authority instanceof Error) return authority
    const candidate = authority.candidates.find(
      (entry) => entry.employeeId === actor.id && entry.accountId === input.accountId,
    )
    if (candidate === undefined) return null

    return { guard, snapshot: authority.snapshot, qualification: candidate.qualification }
  }
}
