import type {
  AccountEmployeeLinkQuery,
  AccountEmployeeLinkReadPort,
  AccountEmployeeLinkReadPortResult,
} from "@/contexts/company/lib/workforce/resolve-account-employee-link"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"

type Context = CompanyContext

/** Company が所有する Account と Employee の対応だけを読み取る。 */
export class AccountEmployeeLinkReadAdapter implements AccountEmployeeLinkReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(query: AccountEmployeeLinkQuery): Promise<AccountEmployeeLinkReadPortResult> {
    const links = await new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({
      asOf: query.asOf,
      ...(query.kind === "by_account"
        ? { accountIds: [query.accountId] }
        : { employeeIds: [query.employeeId] }),
    })
    if (links instanceof Error) return { ok: false, cause: links }
    return { ok: true, records: links.map((link) => ({ link })) }
  }
}
