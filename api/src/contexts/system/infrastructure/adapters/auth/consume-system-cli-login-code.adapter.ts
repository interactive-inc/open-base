import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 未失効のCLI token交換用codeをDELETE RETURNINGで一度だけ消費する。 */
export class ConsumeSystemCliLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async consumeSystemCliLoginCode(
    codeHash: string,
    now: Date,
  ): Promise<Readonly<{ accountId: AccountId; tokenVersion: number }> | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `DELETE FROM system_cli_login_codes
       WHERE code_hash = ?1 AND created_at <= ?2 AND expires_at > ?2
         AND EXISTS (SELECT 1 FROM system_accounts account WHERE account.id=account_id AND account.status='active' AND account.closed_at IS NULL AND account.token_version=system_cli_login_codes.token_version)
       RETURNING account_id, token_version`,
      )
        .bind(codeHash, now.getTime())
        .first<{ account_id: string; token_version: number }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      return accountId.success && Number.isSafeInteger(row.token_version) && row.token_version >= 0
        ? { accountId: accountId.data, tokenVersion: row.token_version }
        : new Error("invalid System AccountEntity ID")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to consume System CLI login code")
    }
  }
}
