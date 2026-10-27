import type { SystemD1Context } from "@system/configuration/system-context"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

export type SystemOidcSignInAccount = Readonly<{
  accountId: AccountId
  /** Identityに登録されたメールアドレス。無ければ null。 */
  email: string | null
}>

/**
 * OIDCのsubjectに結び付いた、有効なIdentityとAccountを引く。
 * 有効化前、失効済みのIdentityや、停止・閉鎖したAccountなら null。
 */
export async function findSystemOidcSignInAccount(
  context: SystemD1Context,
  subject: string,
): Promise<SystemOidcSignInAccount | null | Error> {
  if (subject.length === 0 || subject.length > 255) return null
  try {
    const row = await context.env.DB.prepare(
      `SELECT identity.account_id, profile.email
       FROM system_identity_bindings identity
       INNER JOIN system_accounts account
         ON account.id = identity.account_id
        AND account.status = 'active' AND account.closed_at IS NULL
       LEFT JOIN system_identity_profiles profile ON profile.identity_id = identity.id
       WHERE identity.provider = 'oidc' AND identity.subject = ?1
         AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
       LIMIT 1`,
    )
      .bind(subject)
      .first<{ account_id: string; email: string | null }>()
    if (row === null) return null
    const accountId = zAccountId.safeParse(row.account_id)
    if (!accountId.success) return new Error("OIDC Account id is invalid")
    return Object.freeze({ accountId: accountId.data, email: row.email })
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to find OIDC sign-in Account")
  }
}
