import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemPrincipalRepository } from "@system/infrastructure/repositories/iam/system-principal.repository"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = Readonly<{ database: D1Database }>

/** 判定時点に存在する有効な人間のAccountだけを会社の判断候補へ渡す。 */
export class CompanyDecisionHumanAccountsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(
    accountIds: ReadonlyArray<string>,
    resolvedAt: Date,
  ): Promise<ReadonlySet<string> | Error> {
    if (!Number.isFinite(resolvedAt.getTime()))
      return new Error("Company decision clock is invalid")
    const parsedAccountIds = zAccountId.array().safeParse(accountIds)
    if (!parsedAccountIds.success) return parsedAccountIds.error
    const accounts = await new SystemAccountRepository({ database: this.c.database }).findMany(
      parsedAccountIds.data,
    )
    if (accounts instanceof Error) return accounts
    const active = accounts.filter(
      (account) =>
        account.status === "active" && account.closedAt === null && account.createdAt <= resolvedAt,
    )
    const principals = await new SystemPrincipalRepository({
      env: { DB: this.c.database },
    }).findMany({ accountIds: active.map((account) => account.id) })
    if (principals instanceof Error) return principals
    return new Set(
      principals
        .filter((principal) => principal.kind === "human" && principal.createdAt <= resolvedAt)
        .map((principal) => String(principal.accountId)),
    )
  }
}
