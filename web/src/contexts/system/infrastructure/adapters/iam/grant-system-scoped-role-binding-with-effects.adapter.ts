import { RevokeSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-binding.adapter"

type Context = Readonly<{
  database: D1Database
  actorAccountId: string
  targetAccountId: string
  bindingId: string
  roleId: string
  resourceType: string
  resourceId: string
  requiredPermissionKey: string
  forbiddenPermissionKey: string
  now: Date
  existing: boolean
  effects: ReadonlyArray<D1PreparedStatement>
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

/** 外部effectも含むD1 batchで、System role付与と監査を原子的に確定する。 */
export class GrantSystemScopedRoleBindingWithEffectsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(): Promise<
    Readonly<{ bindingId: string; created: boolean }> | "forbidden" | "conflict" | Error
  > {
    const { c } = this
    const now = c.now.getTime()
    const statements: D1PreparedStatement[] = [
      c.database
        .prepare(
          `SELECT CASE WHEN EXISTS (
           SELECT 1 FROM system_accounts actor
           JOIN system_role_bindings actor_binding ON actor_binding.account_id = actor.id
           JOIN system_iam_role_permissions permission ON permission.role_id = actor_binding.role_id
           WHERE actor.id = ?1 AND actor.status = 'active' AND actor.closed_at IS NULL
             AND actor_binding.revoked_at IS NULL
             AND (actor_binding.resource_type IS NULL OR
               (actor_binding.resource_type = ?3 AND actor_binding.resource_id = ?4))
             AND permission.permission_key = ?5
         ) AND EXISTS (
           SELECT 1 FROM system_accounts target
           WHERE target.id = ?2 AND target.status = 'active' AND target.closed_at IS NULL
         ) AND EXISTS (
           SELECT 1 FROM system_iam_roles role
           WHERE role.id = ?6 AND role.resource_type = ?3
         ) AND NOT EXISTS (
           SELECT 1 FROM system_iam_role_permissions permission
           WHERE permission.role_id = ?6 AND permission.permission_key = ?7
         ) AND NOT EXISTS (
           SELECT 1 FROM system_iam_role_permissions required
           WHERE required.role_id = ?6 AND NOT EXISTS (
             SELECT 1 FROM system_role_bindings actor_role
             JOIN system_iam_role_permissions possessed ON possessed.role_id = actor_role.role_id
             WHERE actor_role.account_id = ?1 AND actor_role.revoked_at IS NULL
               AND (actor_role.resource_type IS NULL OR
                 (actor_role.resource_type = ?3 AND actor_role.resource_id = ?4))
               AND possessed.permission_key = required.permission_key
           )
         ) AND NOT EXISTS (
           SELECT 1 FROM system_role_bindings current
           WHERE current.account_id = ?2 AND current.resource_type = ?3 AND current.resource_id = ?4
             AND current.revoked_at IS NULL AND (?8 = 0 OR current.id <> ?9 OR current.role_id <> ?6)
         ) AND (?8 = 0 OR EXISTS (
           SELECT 1 FROM system_role_bindings expected
           WHERE expected.id = ?9 AND expected.account_id = ?2 AND expected.role_id = ?6
             AND expected.resource_type = ?3 AND expected.resource_id = ?4
             AND expected.revoked_at IS NULL
         )) THEN 1 ELSE json_extract('', '$') END AS ok`,
        )
        .bind(
          c.actorAccountId,
          c.targetAccountId,
          c.resourceType,
          c.resourceId,
          c.requiredPermissionKey,
          c.roleId,
          c.forbiddenPermissionKey,
          c.existing ? 1 : 0,
          c.bindingId,
        ),
      ...c.effects,
    ]
    if (!c.existing) {
      statements.push(
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
        ...c.auditStatements,
      )
    }
    try {
      const results = await c.database.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? { bindingId: c.bindingId, created: !c.existing }
        : new Error("System scoped role grant batch did not succeed")
    } catch (caught) {
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique"))
        return "conflict"
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        const allowed = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
          database: c.database,
          actorAccountId: c.actorAccountId,
          resourceType: c.resourceType,
          resourceId: c.resourceId,
          requiredPermissionKey: c.requiredPermissionKey,
          targetRoleId: c.roleId,
        })
        if (allowed instanceof Error) return allowed
        return allowed ? "conflict" : "forbidden"
      }
      return caught instanceof Error ? caught : new Error("System scoped role grant failed")
    }
  }
}
