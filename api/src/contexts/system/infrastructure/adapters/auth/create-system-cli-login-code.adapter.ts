import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** CLI token交換用codeのhash・Account・認証版を短期間保存する。 */
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
      const result = await this.c.env.DB.prepare(
        `INSERT INTO system_cli_login_codes
         (code_hash, account_id, created_at, expires_at, token_version)
       SELECT ?1, id, ?3, ?4, token_version FROM system_accounts
       WHERE id=?2 AND status='active' AND closed_at IS NULL AND token_version=?5 AND created_at<=?3`,
      )
        .bind(
          input.codeHash,
          input.accountId,
          input.createdAt.getTime(),
          input.expiresAt.getTime(),
          input.tokenVersion,
        )
        .run()
      return result.success && result.meta.changes === 1
        ? null
        : new Error("CLI code authorization changed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System CLI login code")
    }
  }
}
