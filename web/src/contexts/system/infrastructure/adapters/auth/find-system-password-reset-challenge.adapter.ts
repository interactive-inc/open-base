import type { PasswordResetTokenHash } from "@system/domain/schemas/auth/password-reset-token-hash.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemPasswordResetChallenge = Readonly<{
  id: string
  accountId: string
  identityId: string
  accountTokenVersion: number
}>
type Context = SystemD1Context

/** 指定時刻に利用可能なchallengeだけを返し、拒否理由は区別しない。 */
export class FindSystemPasswordResetChallengeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findSystemPasswordResetChallenge(
    tokenHash: PasswordResetTokenHash,
    now: Date,
  ): Promise<SystemPasswordResetChallenge | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT challenge.id, challenge.account_id, challenge.identity_id,
              account.token_version AS account_token_version
       FROM system_password_reset_challenges AS challenge
       INNER JOIN system_accounts AS account ON account.id = challenge.account_id
       INNER JOIN system_identity_bindings AS binding
         ON binding.id = challenge.identity_id AND binding.account_id = challenge.account_id
       INNER JOIN system_password_credentials AS credential
         ON credential.identity_id = challenge.identity_id
       WHERE challenge.token_hash = ?1
         AND challenge.used_at IS NULL
         AND challenge.created_at <= ?2
         AND challenge.expires_at >= ?2
         AND account.status = 'active'
         AND binding.provider = 'password'
         AND binding.revoked_at IS NULL
       LIMIT 1`,
      )
        .bind(tokenHash, now.getTime())
        .first<Record<string, unknown>>()

      if (row === null) return null
      if (
        typeof row.id !== "string" ||
        typeof row.account_id !== "string" ||
        typeof row.identity_id !== "string" ||
        typeof row.account_token_version !== "number" ||
        !Number.isSafeInteger(row.account_token_version) ||
        row.account_token_version < 0
      ) {
        return new Error("password reset challenge is invalid")
      }

      return Object.freeze({
        id: row.id,
        accountId: row.account_id,
        identityId: row.identity_id,
        accountTokenVersion: row.account_token_version,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find password reset challenge")
    }
  }
}
