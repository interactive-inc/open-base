import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { readSystemAccountSnapshot } from "@system/interface/operations/read-system-account-snapshot"

export type SystemInitialPasswordTarget = Readonly<{
  user: Readonly<{ id: string; disabledAt: Date | null }> | null
  identities: ReadonlyArray<
    Readonly<{ id: string; email: string | null; canReceiveEmail: boolean }>
  >
  targetHasRootGrant: boolean
}>

/** 初期password発行に必要なAccount、連絡先、現在有効なroot権限を読む。credentialは返さない。 */
export async function readSystemInitialPasswordTarget(
  database: D1Database,
  accountId: string,
): Promise<SystemInitialPasswordTarget | Error> {
  const parsed = zAccountId.safeParse(accountId)
  if (!parsed.success) return new Error("Invalid System Account ID")
  try {
    const [account, identities, root] = await Promise.all([
      readSystemAccountSnapshot(database, parsed.data),
      database
        .prepare(
          `SELECT identity.id, profile.email, profile.can_receive_email
           FROM system_identity_bindings AS identity
           LEFT JOIN system_identity_profiles AS profile ON profile.identity_id = identity.id
           WHERE identity.account_id = ?1 AND identity.provider = 'password'
           ORDER BY identity.created_at, identity.id`,
        )
        .bind(parsed.data)
        .all<{ id: string; email: string | null; can_receive_email: number | null }>(),
      database
        .prepare(
          `SELECT 1 AS found
           FROM system_role_bindings AS binding
           JOIN system_iam_role_permissions AS grant_row ON grant_row.role_id = binding.role_id
           WHERE binding.account_id = ?1 AND binding.revoked_at IS NULL
             AND grant_row.permission_key = 'system:admin' LIMIT 1`,
        )
        .bind(parsed.data)
        .first<{ found: number }>(),
    ])
    if (account instanceof Error) return account
    const mappedIdentities: Array<{
      id: string
      email: string | null
      canReceiveEmail: boolean
    }> = []
    for (const row of identities.results) {
      if (
        row.can_receive_email !== null &&
        row.can_receive_email !== 0 &&
        row.can_receive_email !== 1
      ) {
        return new Error("Invalid System Identity email eligibility")
      }
      mappedIdentities.push({
        id: row.id,
        email: row.email,
        canReceiveEmail: row.can_receive_email === 1,
      })
    }
    return {
      user:
        account === null
          ? null
          : {
              id: account.id,
              disabledAt:
                account.closedAt ?? (account.status === "active" ? null : account.updatedAt),
            },
      identities: mappedIdentities,
      targetHasRootGrant: root !== null,
    }
  } catch (cause) {
    return cause instanceof Error
      ? cause
      : new Error("System initial password target lookup failed")
  }
}
