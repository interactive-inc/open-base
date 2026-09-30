import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyGovernanceAuthorityCandidate } from "@/contexts/company/domain/policies/company-governance-authority.policy"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"

type Context = Readonly<{ env: CompanyContext["env"] }>
type Props = Readonly<{
  candidates: ReadonlyArray<CompanyGovernanceAuthorityCandidate>
  asOf: CalendarDate
  resolvedAt: Date
}>

/** 公開候補のAccount対応と在籍を正本の期間台帳と照合する。 */
export class CompanyDecisionParticipantsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async validate(input: Props): Promise<Error | null> {
    const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({
      asOf: input.asOf,
      accountIds: input.candidates.map((candidate) => candidate.accountId),
    })
    if (links instanceof Error) return links
    const linksByAccount = new Map(
      links.map((link) => [String(link.accountId), String(link.employeeId)]),
    )
    const accesses = await new ResolveLiveEmployeeAccessAdapter({
      env: {
        DB: this.c.env.DB,
        COMPANY_TIME_ZONE: this.c.env.COMPANY_TIME_ZONE,
        NOW: input.resolvedAt.toISOString(),
      },
    }).resolveMany(
      input.candidates.map((candidate) => restoreWorkforceId("employee", candidate.employeeId)),
      input.asOf,
    )
    if (accesses instanceof Error) return accesses
    for (const candidate of input.candidates) {
      if (linksByAccount.get(candidate.accountId) !== candidate.employeeId) {
        return new Error("public Company authority does not match the canonical Account link")
      }
      const access = accesses.get(restoreWorkforceId("employee", candidate.employeeId))
      if (access === undefined || access === null || access.status !== "ACTIVE")
        return new Error("Company decision participant is inactive")
    }
    return null
  }
}
