import { findCompanyEmployeeProfileSnapshot } from "@/contexts/company/interface/operations/find-company-employee-profile-snapshot"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { Context } from "@/env"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { zAppAuthMe } from "@/api/http/company/response-schemas"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"

/** System SessionとCompany従業員を現在利用者の表示profileへ合成する。 */
export class GetCurrentCompanyProfile {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute() {
    const session = this.c.var.session
    if (session === null) throw new UnauthorizedError()
    if (session.employeeId === null) throw new NotFoundError("employee not found")
    const employee = await openCompanyEmployeeDirectory(this.c).findById(
      restoreWorkforceId("employee", String(session.employeeId)),
    )
    if (employee instanceof Error) throw new InternalError("failed to load employee profile")
    if (employee === null) throw new NotFoundError("employee not found")

    const effectiveOn = resolveCompanyBusinessDate({
      now: this.c.env.NOW ?? new Date().toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (effectiveOn instanceof Error) throw new InternalError("failed to resolve company date")
    const profile = await findCompanyEmployeeProfileSnapshot(this.c.env.DB, {
      employeeId: employee.id,
      effectiveOn,
    })
    if (profile instanceof Error)
      throw new InternalError("failed to load employee profile revision")
    return zAppAuthMe.parse({
      id: employee.id,
      code: employee.employeeCode,
      name: profile?.person.readText("officialName") ?? employee.officialName,
      email: employee.email ?? "",
      role: session.roleKeys[0] ?? "authenticated",
      dept_name: employee.primaryAssignment?.organizationUnitName ?? null,
      position: employee.primaryAssignment?.positionTitle ?? null,
      permissions: [...session.permissions],
      role_keys: [...session.roleKeys],
      phone: profile === null ? employee.phone : (profile.person.readNullableText("phone") ?? null),
      profile: profile?.version ?? null,
    })
  }
}
