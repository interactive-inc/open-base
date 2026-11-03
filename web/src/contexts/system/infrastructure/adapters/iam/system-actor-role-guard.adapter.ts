type Context = Readonly<{
  database: D1Database
  actorAccountId: string
  permissionKeys?: ReadonlyArray<string>
  storedRoleId?: string | null
  /** 指定時は管理者以外の自己付与も拒否する。 */
  targetAccountId?: string | null
}>

/** 操作者の有効な全体権限と、保存前後のロールの全権限を同じ保存単位で照合する。 */
export class SystemActorRoleGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(): D1PreparedStatement {
    return this.c.database
      .prepare(
        `WITH actor_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_accounts account
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.id = ?1
           AND account.status = 'active'
           AND account.closed_at IS NULL
           AND binding.resource_type IS NULL
           AND binding.resource_id IS NULL
           AND binding.revoked_at IS NULL
       )
       SELECT CASE WHEN
         EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
         OR (
           EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
           AND (?4 IS NULL OR ?1 <> ?4)
           AND NOT EXISTS (
             SELECT 1 FROM (
               SELECT CAST(value AS TEXT) AS key FROM json_each(?2)
               UNION
               SELECT permission_key AS key FROM system_iam_role_permissions WHERE role_id = ?3
             ) required_permission
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor
               WHERE actor.key = required_permission.key
             )
           )
         )
       THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
      )
      .bind(
        this.c.actorAccountId,
        JSON.stringify(this.c.permissionKeys ?? []),
        this.c.storedRoleId ?? null,
        this.c.targetAccountId ?? null,
      )
  }
}
