import { AccountEntity } from "@system/domain/entities/account.entity"
import type { SystemAccountDirectoryEntry } from "@system/domain/definitions/system-iam-read-models.definition"

type Context = D1Database
type Row = Readonly<{
  id: unknown
  status: unknown
  token_version: unknown
  closed_at: unknown
  created_at: unknown
  updated_at: unknown
  identity_id: unknown
  email: unknown
}>

/** System Accountと有効Identityを、必要なIDだけの公開ディレクトリへ変換する。 */
export class ReadSystemAccountDirectoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async read(
    accountIds: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<SystemAccountDirectoryEntry> | Error> {
    try {
      const entries = new Map<
        string,
        {
          account: AccountEntity
          hasLoginIdentity: boolean
          email: string | null
        }
      >()
      for (let index = 0; index < accountIds.length; index += 100) {
        const result = await this.c
          .prepare(
            `SELECT account.id, account.status, account.token_version, account.closed_at,
                  account.created_at, account.updated_at,
                  identity.id AS identity_id, profile.email
           FROM system_accounts account
           LEFT JOIN system_identity_bindings identity
             ON identity.account_id = account.id
            AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
           LEFT JOIN system_identity_profiles profile ON profile.identity_id = identity.id
           WHERE account.id IN (SELECT value FROM json_each(?1))
           ORDER BY account.id, profile.email_verified DESC, identity.created_at, identity.id`,
          )
          .bind(JSON.stringify(accountIds.slice(index, index + 100)))
          .all<Row>()
        if (!result.success) return new Error("failed to read System Account directory")

        for (const row of result.results) {
          const createdAt =
            typeof row.created_at === "number" ? new Date(row.created_at) : row.created_at
          const updatedAt =
            typeof row.updated_at === "number" ? new Date(row.updated_at) : row.updated_at
          const closedAt =
            row.closed_at === null
              ? null
              : typeof row.closed_at === "number"
                ? new Date(row.closed_at)
                : row.closed_at
          const account = AccountEntity.create({
            id: row.id,
            status: row.status,
            tokenVersion: row.token_version,
            closedAt,
            createdAt,
            updatedAt,
          })
          if (account instanceof Error) return account
          if (row.identity_id !== null && typeof row.identity_id !== "string") {
            return new Error("invalid System Identity ID")
          }
          if (row.email !== null && (typeof row.email !== "string" || row.email.length > 320)) {
            return new Error("invalid System Identity email")
          }
          const existing = entries.get(account.id)
          const entry = existing ?? {
            account,
            hasLoginIdentity: false,
            email: null,
          }
          entry.hasLoginIdentity ||= row.identity_id !== null
          if (entry.email === null && typeof row.email === "string") entry.email = row.email
          entries.set(account.id, entry)
        }
      }
      return Object.freeze(
        [...entries.values()].map(({ account, hasLoginIdentity, email }) =>
          Object.freeze({
            id: account.id,
            status: account.status,
            updatedAt: account.updatedAt,
            hasLoginIdentity,
            email,
          }),
        ),
      )
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System Account directory")
    }
  }
}
