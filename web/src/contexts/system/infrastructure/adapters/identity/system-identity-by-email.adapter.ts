import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemIdentityByEmail = Readonly<{
  accountId: AccountId
  identityId: IdentityId
}>
type Context = SystemD1Context

/** verified email を持つactive System Identityを検索する。 */
export class SystemIdentityByEmailAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(email: string): Promise<SystemIdentityByEmail | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT identity.id AS identity_id, identity.account_id
         FROM system_identity_profiles profile
         INNER JOIN system_identity_bindings identity ON identity.id = profile.identity_id
         WHERE lower(profile.email) = lower(?1)
           AND profile.email_verified = 1
           AND identity.activated_at IS NOT NULL
           AND identity.revoked_at IS NULL
         ORDER BY CASE WHEN identity.provider = 'password' THEN 0 ELSE 1 END,
                  identity.created_at, identity.id
         LIMIT 1`,
      )
        .bind(email)
        .first<{ account_id: unknown; identity_id: unknown }>()
      if (row === null) return null
      const accountId = zAccountId.safeParse(row.account_id)
      const identityId = zIdentityId.safeParse(row.identity_id)
      if (!accountId.success || !identityId.success) {
        return new Error("System Identity email index is invalid")
      }

      return Object.freeze({ accountId: accountId.data, identityId: identityId.data })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System Identity by email")
    }
  }
}
