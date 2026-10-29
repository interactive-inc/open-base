import type { Bindings, Variables } from "@/env"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { resolveCompanyAccountEmployeeLink } from "@/contexts/company/interface/operations/resolve-company-account-employee-link"
import { resolveCompanyLiveEmployeeAccess } from "@/contexts/company/interface/operations/resolve-company-live-employee-access"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { SystemAccountEligibilityAdapter } from "@/api/http/accounts/system-account-eligibility.adapter"
import { prepareSystemReadAuthorization } from "@system/interface/operations/prepare-system-read-authorization"
import { ForbiddenError, UnavailableError } from "@/lib/errors"

type Context = CompanyContext &
  Readonly<{
    env: Bindings
    var: Pick<Variables, "bearerReadAuthentication">
  }>

/** 手動送信の主体と宛先参照を、通知・配送の保存transactionへ束縛する。 */
export class EmployeeNotificationAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: Readonly<{ session: CompanySessionValue; recipientEmployeeCode: string }>) {
    const authentication = this.c.var.bearerReadAuthentication
    if (authentication === undefined || authentication.accountId !== input.session.accountId)
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    const at = new Date(this.c.env.NOW ?? Date.now())
    const bearer = await prepareSystemReadAuthorization({
      database: this.c.env.DB,
      authentication,
      at,
    })
    if (bearer instanceof Error) return this.unavailable(bearer)
    if (bearer === null || !bearer.permissionKeys.has("notification:send"))
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    const businessDate = resolveCompanyBusinessDate({
      now: at.toISOString(),
      timeZone: this.c.env.COMPANY_TIME_ZONE,
    })
    if (businessDate instanceof Error) return this.unavailable(businessDate)
    const company = await prepareCompanyAuthoritySnapshotGuard(
      { database: this.c.env.DB },
      {
        accountIds: [authentication.accountId],
        employeeCodes: [input.recipientEmployeeCode],
      },
    )
    if (company instanceof Error) return this.unavailable(company)
    const sender = await this.validateSender(input.session)
    if (sender instanceof Error) return sender
    return () => {
      const now = new Date(this.c.env.NOW ?? Date.now())
      if (!Number.isSafeInteger(now.getTime())) return this.unavailable()
      const currentDate = resolveCompanyBusinessDate({
        now: now.toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (currentDate instanceof Error || currentDate !== businessDate) return this.unavailable()
      const assertions = bearer.assertions(now)
      if (assertions instanceof Error) return this.unavailable(assertions)
      return [company, ...assertions]
    }
  }

  private async validateSender(session: CompanySessionValue) {
    const sender = await resolveCompanyAccountEmployeeLink(
      this.c,
      new SystemAccountEligibilityAdapter(this.c.env.DB),
      {
        kind: "by_account",
        accountId: restoreWorkforceId("system_account", session.accountId),
      },
    )
    if (sender.kind === "unavailable") return this.unavailable(sender.cause)
    if (sender.kind !== "found" || sender.link.employeeId !== session.employeeId)
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    const access = await resolveCompanyLiveEmployeeAccess(this.c, sender.link.employeeId)
    if (access instanceof Error) return this.unavailable(access)
    if (access === null)
      return new ForbiddenError("cannot send notification", "notification_forbidden")
    return true
  }

  private unavailable(cause?: unknown) {
    return new UnavailableError(
      "notification authorization is unavailable",
      "notification_unavailable",
      { cause },
    )
  }
}
