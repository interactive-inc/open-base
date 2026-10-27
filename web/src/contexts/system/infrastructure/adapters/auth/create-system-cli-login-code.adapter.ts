import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** CLI token交換用codeのhashとAccount、発行時のtoken versionを短期間保存する。 */
export class CreateSystemCliLoginCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createSystemCliLoginCode(
    input: Readonly<{
      codeHash: string
      accountId: AccountId
      tokenVersion: number
      createdAt: Date
      expiresAt: Date
    }>,
  ): Promise<null | Error> {
    try {
      await this.c.env.DB.prepare(
        `INSERT INTO system_cli_login_codes
         (code_hash, account_id, token_version, created_at, expires_at)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
      )
        .bind(
          input.codeHash,
          input.accountId,
          input.tokenVersion,
          input.createdAt.getTime(),
          input.expiresAt.getTime(),
        )
        .run()
      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System CLI login code")
    }
  }
}
