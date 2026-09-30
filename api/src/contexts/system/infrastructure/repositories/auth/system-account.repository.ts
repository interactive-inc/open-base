import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AccountEntity } from "@system/domain/entities/account.entity"
import {
  getAccountSessionRejection,
  type AccountSessionRejection,
} from "@system/domain/policies/account-session.policy"
import { systemAccounts } from "@system/infrastructure/schema/system-core"
import { eq, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

function createDatabase(database: D1Database) {
  return drizzle(database, { schema: { systemAccounts } })
}

type Props = Readonly<{
  database: D1Database | Pick<ReturnType<typeof createDatabase>, "select">
}>
type SystemAccountRepositoryContext = Props
type Context = SystemAccountRepositoryContext

/** canonical System AccountEntity tableだけを読むD1 repository。 */
export class SystemAccountRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(accountId: AccountId): Promise<AccountEntity | null | Error> {
    try {
      const database =
        "select" in this.c.database ? this.c.database : createDatabase(this.c.database)
      const rows = await database
        .select()
        .from(systemAccounts)
        .where(eq(systemAccounts.id, accountId))
        .limit(1)
      const row = rows.at(0)

      return row === undefined ? null : AccountEntity.create(row)
    } catch (error) {
      return error instanceof Error ? error : new Error("failed to read System AccountEntity")
    }
  }

  /** 指定されたAccountを一括復元し、欠損と停止状態を呼び出し元へそのまま返す。 */
  async findMany(
    accountIds: ReadonlyArray<AccountId>,
  ): Promise<ReadonlyArray<AccountEntity> | Error> {
    if (accountIds.length === 0) return []
    try {
      const database =
        "select" in this.c.database ? this.c.database : createDatabase(this.c.database)
      const rows = await database
        .select()
        .from(systemAccounts)
        .where(
          sql`${systemAccounts.id} IN (SELECT value FROM json_each(${JSON.stringify([...new Set(accountIds)])}))`,
        )
        .orderBy(systemAccounts.id)
      const accounts: AccountEntity[] = []
      for (const row of rows) {
        const account = AccountEntity.create(row)
        if (account instanceof Error) return account
        accounts.push(account)
      }
      return Object.freeze(accounts)
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("failed to read System Accounts")
    }
  }

  /** canonical AccountEntityの現在状態からSession継続可否を解決するrepository read。 */
  static async resolveSession(props: {
    accountRepository: Pick<SystemAccountRepository, "find">
    accountId: AccountId
    sessionTokenVersion: number
  }): Promise<
    | Readonly<{ kind: "accepted"; account: AccountEntity }>
    | Readonly<{
        kind: "rejected"
        reason: AccountSessionRejection | "account_not_found"
      }>
    | Error
  > {
    const account = await props.accountRepository.find(props.accountId)

    if (account instanceof Error) return account
    if (account === null) return { kind: "rejected", reason: "account_not_found" }

    const rejection = getAccountSessionRejection({
      accountStatus: account.status,
      accountTokenVersion: account.tokenVersion,
      sessionTokenVersion: props.sessionTokenVersion,
    })

    return rejection === null
      ? { kind: "accepted", account }
      : { kind: "rejected", reason: rejection }
  }
}
