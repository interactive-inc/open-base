import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 未失効のCLI token交換用codeをDELETE RETURNINGで一度だけ消費し、発行時のtoken versionを返す。 */
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
       WHERE code_hash = ?1 AND expires_at > ?2
       RETURNING account_id, token_version`,
      )
        .bind(codeHash, now.getTime())
        .first<{ account_id: string; token_version: number }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      if (!accountId.success) return new Error("invalid System AccountEntity ID")
      if (!Number.isSafeInteger(row.token_version) || row.token_version < 0) {
        return new Error("invalid System CLI login code token version")
      }
      return { accountId: accountId.data, tokenVersion: row.token_version }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to consume System CLI login code")
    }
  }
}
