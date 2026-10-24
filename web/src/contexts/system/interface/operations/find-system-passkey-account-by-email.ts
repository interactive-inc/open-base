import type { SystemD1Context } from "@system/configuration/system-context"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 失効していないパスキーのIdentityのメールアドレスから、有効なAccountを1件だけ引く。 */
export async function findSystemPasskeyAccountByEmail(
  context: SystemD1Context,
  email: string,
): Promise<AccountId | null | Error> {
  try {
    const rows = await context.env.DB.prepare(
      `SELECT DISTINCT identity.account_id
       FROM system_identity_profiles profile
       INNER JOIN system_identity_bindings identity
         ON identity.id = profile.identity_id
        AND identity.provider = 'passkey' AND identity.revoked_at IS NULL
       INNER JOIN system_accounts account
         ON account.id = identity.account_id
        AND account.status = 'active' AND account.closed_at IS NULL
       WHERE profile.email = ?1
       LIMIT 2`,
    )
      .bind(email)
      .all<{ account_id: string }>()
    if (!rows.success) return new Error("failed to find passkey Account by email")
    // 同じメールアドレスのAccountが複数あれば、どれか一方を選ばずに見つからない扱いにする。
    if (rows.results.length !== 1) return null
    const accountId = zAccountId.safeParse(rows.results[0]?.account_id)
    return accountId.success ? accountId.data : new Error("passkey Account id is invalid")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to find passkey Account by email")
  }
}
