import { AccountEmployeeLinkReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/account-employee-link-read.adapter"
import {
  ResolveAccountEmployeeLink,
  type AccountEligibilityPort,
  type AccountEligibilityPortResult,
  type AccountEmployeeLinkQuery,
  type ResolveAccountEmployeeLinkResult,
} from "@/contexts/company/lib/workforce/resolve-account-employee-link"

export type CompanyAccountEligibility = AccountEligibilityPort

export type CompanyAccountEligibilityResult = AccountEligibilityPortResult

/** Account と従業員の対応を、呼び出し側の Account 適格性で検査して解決する公開境界。 */
export function resolveCompanyAccountEmployeeLink(
  c: ConstructorParameters<typeof AccountEmployeeLinkReadAdapter>[0],
  eligibility: AccountEligibilityPort,
  query: AccountEmployeeLinkQuery,
): Promise<ResolveAccountEmployeeLinkResult> {
  return new ResolveAccountEmployeeLink(new AccountEmployeeLinkReadAdapter(c), eligibility).execute(
    query,
  )
}
