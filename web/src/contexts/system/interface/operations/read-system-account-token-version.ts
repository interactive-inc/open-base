import type { SystemD1Context } from "@system/configuration/system-context"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

/**
 * 指定した方式でサインインできるAccountの現在のtoken版を返す。できなければ null。
 * Better Authのセッションを作るときに記録し、API側で現在の値と照合する。
 */
export async function readSystemAccountTokenVersion(
  context: SystemD1Context,
  accountIdInput: string,
  provider: "password" | "passkey" | "oidc",
): Promise<number | null | Error> {
  const accountId = zAccountId.safeParse(accountIdInput)
  if (!accountId.success) return null
  try {
    // その方式の有効で失効していないIdentityを持つAccountだけがセッションを作れる。
    const version = await context.env.DB.prepare(
      `SELECT account.token_version
       FROM system_accounts account
       WHERE account.id = ?1 AND account.status = 'active' AND account.closed_at IS NULL
         AND EXISTS (
           SELECT 1 FROM system_identity_bindings identity
           WHERE identity.account_id = account.id AND identity.provider = ?2
             AND identity.activated_at IS NOT NULL AND identity.revoked_at IS NULL
         )`,
    )
      .bind(accountId.data, provider)
      .first<number>("token_version")
    return version
  } catch (caught) {
    return caught instanceof Error
      ? caught
      : new Error("failed to read System Account token version")
  }
}
