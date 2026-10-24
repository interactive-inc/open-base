type Context = Readonly<{
  database: D1Database
  actorAccountId: string
  targetAccountId: string
  bindingId: string
  roleId: string
  resourceType: string
  resourceId: string
  requiredPermissionKey: string
  managerPermissionKey: string
  now: Date
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

/** Resource上のrole置換を、live権限・履歴・Account版・監査とともに原子的に行う。 */
export class ReplaceSystemScopedRoleBindingAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(): Promise<
    "replaced" | "forbidden" | "not_found" | "conflict" | "last_manager" | Error
  > {
    const { c } = this
    const now = c.now.getTime()
    const statements = [
      c.database
        .prepare(
          `SELECT CASE WHEN EXISTS (
           SELECT 1 FROM system_accounts actor
           JOIN system_role_bindings actor_binding ON actor_binding.account_id = actor.id
           JOIN system_iam_role_permissions actor_permission ON actor_permission.role_id = actor_binding.role_id
           WHERE actor.id = ?1 AND actor.status = 'active' AND actor.closed_at IS NULL
             AND actor_binding.revoked_at IS NULL
             AND (actor_binding.resource_type IS NULL OR
               (actor_binding.resource_type = ?3 AND actor_binding.resource_id = ?4))
             AND actor_permission.permission_key = ?5
         ) AND EXISTS (
           SELECT 1 FROM system_accounts target
           WHERE target.id = ?2 AND target.status = 'active' AND target.closed_at IS NULL
         ) AND EXISTS (
           SELECT 1 FROM system_iam_roles role
           WHERE role.id = ?6 AND role.resource_type = ?3
         ) AND NOT EXISTS (
           SELECT 1 FROM system_iam_role_permissions required
           WHERE (required.role_id = ?6 OR required.role_id IN (
             SELECT old.role_id FROM system_role_bindings old
             WHERE old.account_id = ?2 AND old.resource_type = ?3 AND old.resource_id = ?4
               AND old.revoked_at IS NULL
           )) AND NOT EXISTS (
             SELECT 1 FROM system_role_bindings actor_role
             JOIN system_iam_role_permissions possessed ON possessed.role_id = actor_role.role_id
             WHERE actor_role.account_id = ?1 AND actor_role.revoked_at IS NULL
               AND (actor_role.resource_type IS NULL OR
                 (actor_role.resource_type = ?3 AND actor_role.resource_id = ?4))
               AND possessed.permission_key = required.permission_key
           )
         ) THEN 1 ELSE json_extract('', '$') END AS ok`,
        )
        .bind(
          c.actorAccountId,
          c.targetAccountId,
          c.resourceType,
          c.resourceId,
          c.requiredPermissionKey,
          c.roleId,
        ),
      c.database
        .prepare(
          `UPDATE system_role_bindings SET revoked_at = ?4
         WHERE account_id = ?1 AND resource_type = ?2 AND resource_id = ?3
           AND revoked_at IS NULL AND created_at <= ?4`,
        )
        .bind(c.targetAccountId, c.resourceType, c.resourceId, now),
      c.database
        .prepare(
          `SELECT CASE WHEN NOT EXISTS (
           SELECT 1 FROM system_role_bindings old
           WHERE old.account_id = ?1 AND old.resource_type = ?2 AND old.resource_id = ?3
             AND old.revoked_at IS NULL
         ) THEN 1 ELSE json_extract('', '$') END AS ok`,
        )
        .bind(c.targetAccountId, c.resourceType, c.resourceId),
      c.database
        .prepare(
          `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)`,
        )
        .bind(c.bindingId, c.targetAccountId, c.roleId, c.resourceType, c.resourceId, now),
      c.database
        .prepare(
          `UPDATE system_accounts SET token_version = token_version + 1,
           updated_at = max(updated_at, ?2)
         WHERE id = ?1 AND token_version < 9007199254740991`,
        )
        .bind(c.targetAccountId, now),
      c.database.prepare(
        "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
      ),
      c.database
        .prepare(
          `SELECT CASE WHEN NOT EXISTS (
           SELECT 1 FROM system_role_bindings replaced
           JOIN system_iam_role_permissions prior_permission ON prior_permission.role_id = replaced.role_id
           WHERE replaced.account_id = ?4 AND replaced.resource_type = ?1
             AND replaced.resource_id = ?2 AND replaced.revoked_at = ?5
             AND prior_permission.permission_key = ?3
         ) OR EXISTS (
           SELECT 1 FROM system_role_bindings remaining
           JOIN system_accounts account ON account.id = remaining.account_id
           JOIN system_iam_role_permissions permission ON permission.role_id = remaining.role_id
           WHERE remaining.resource_type = ?1 AND remaining.resource_id = ?2
             AND remaining.revoked_at IS NULL AND account.status = 'active'
             AND account.closed_at IS NULL AND permission.permission_key = ?3
         ) THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
        )
        .bind(c.resourceType, c.resourceId, c.managerPermissionKey, c.targetAccountId, now),
      ...c.auditStatements,
    ]
    try {
      const results = await c.database.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? "replaced"
        : new Error("System scoped role replacement batch did not succeed")
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow"))
        return "last_manager"
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique"))
        return "conflict"
      if (caught instanceof Error && caught.message.includes("malformed JSON")) return "forbidden"
      return caught instanceof Error ? caught : new Error("System scoped role replacement failed")
    }
  }
}
