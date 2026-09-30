import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"

/** Company の操作主体が active な canonical System Account かを確認する。 */
async function resolveActiveSystemAccountId(
  context: CompanyContext,
  accountIdInput: string,
): Promise<AccountId | Error> {
  const accountId = zAccountId.safeParse(accountIdInput)
  if (!accountId.success) return new Error("canonical System Account ID is invalid")

  const account = await new SystemAccountRepository({ database: context.env.DB }).find(
    accountId.data,
  )
  if (account instanceof Error) {
    return new Error("failed to resolve canonical System Account", { cause: account })
  }

  return account?.status === "active"
    ? accountId.data
    : new Error("canonical System Account is not active")
}
type Context = CompanyContext

export class ResolveActiveSystemAccountIdAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveActiveSystemAccountId(accountIdInput: string): Promise<AccountId | Error> {
    return resolveActiveSystemAccountId(this.c, accountIdInput)
  }

  async isActiveSystemAccount(accountIdInput: string): Promise<boolean | Error> {
    const accountId = zAccountId.safeParse(accountIdInput)
    if (!accountId.success) return new Error("canonical System Account ID is invalid")
    const account = await new SystemAccountRepository({ database: this.c.env.DB }).find(
      accountId.data,
    )
    if (account instanceof Error) {
      return new Error("failed to resolve canonical System Account", { cause: account })
    }
    return account?.status === "active"
  }
}
