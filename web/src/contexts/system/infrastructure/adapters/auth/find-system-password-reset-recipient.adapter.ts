import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemPasswordResetRecipient = Readonly<{
  accountId: string
  identityId: string
  email: string
}>
type Context = SystemD1Context

/** verified emailに対応するactive password identityだけを返す。 */
export class FindSystemPasswordResetRecipientAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findSystemPasswordResetRecipient(
    email: string,
  ): Promise<SystemPasswordResetRecipient | null | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT binding.account_id, binding.id AS identity_id, profile.email
       FROM system_identity_bindings AS binding
       INNER JOIN system_identity_profiles AS profile ON profile.identity_id = binding.id
       INNER JOIN system_password_credentials AS credential ON credential.identity_id = binding.id
       INNER JOIN system_accounts AS account ON account.id = binding.account_id
       WHERE binding.provider = 'password'
         AND binding.subject = ?1
         AND binding.activated_at IS NOT NULL
         AND binding.revoked_at IS NULL
         AND profile.email = ?1
         AND profile.email_verified = 1
         AND account.status = 'active'
       LIMIT 2`,
      )
        .bind(email)
        .all<Record<string, unknown>>()
      const values = rows.results

      if (values.length === 0) return null
      if (values.length !== 1) return new Error("password reset recipient is ambiguous")

      const row = values[0]
      if (
        typeof row?.account_id !== "string" ||
        typeof row.identity_id !== "string" ||
        typeof row.email !== "string"
      ) {
        return new Error("password reset recipient is invalid")
      }

      return Object.freeze({
        accountId: row.account_id,
        identityId: row.identity_id,
        email: row.email,
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find password reset recipient")
    }
  }
}
