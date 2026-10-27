type Context = Readonly<{
  database: D1Database
  /** Identityの失効では、対象がrootである場合だけ検査する。 */
  targetAccountId?: string
}>

/** ログイン可能な有効rootが残ることを、変更と同じbatchで検査する。 */
export class SystemLastRootGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(): D1PreparedStatement {
    return this.c.database
      .prepare(
        `SELECT CASE WHEN (
         ?1 IS NOT NULL AND NOT EXISTS (
           SELECT 1
           FROM system_role_bindings binding
           INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
           WHERE binding.account_id = ?1
             AND binding.resource_type IS NULL
             AND binding.resource_id IS NULL
             AND binding.revoked_at IS NULL
             AND permission.permission_key = 'system:admin'
         )
       ) OR EXISTS (
         SELECT 1
         FROM system_accounts account
         INNER JOIN system_identity_bindings identity ON identity.account_id = account.id
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.status = 'active'
           AND account.closed_at IS NULL
           AND identity.activated_at IS NOT NULL
           AND identity.revoked_at IS NULL
           AND binding.resource_type IS NULL
           AND binding.resource_id IS NULL
           AND binding.revoked_at IS NULL
           AND permission.permission_key = 'system:admin'
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
      )
      .bind(this.c.targetAccountId ?? null)
  }
}
