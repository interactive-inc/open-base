import type { RoleBindingEntity } from "@system/domain/entities/role-binding.entity"

type Context = Readonly<{
  database: D1Database
  actorAccountId: string
  targetAccountId: string
  binding: RoleBindingEntity
  resourceType: string
  resourceId: string
  requiredPermissionKey: string
  managerPermissionKey: string
  now: Date
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

/** Resource管理者によるSystem binding取消を、権限・残存管理者・監査と原子的に保存する。 */
export class RevokeSystemScopedRoleBindingAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  static async canActorManage(
    input: Readonly<{
      database: D1Database
      actorAccountId: string
      resourceType: string
      resourceId: string
      requiredPermissionKey: string
      targetRoleId?: string
    }>,
  ): Promise<boolean | Error> {
    try {
      const row = await input.database
        .prepare(
          `SELECT EXISTS (
             SELECT 1 FROM system_accounts actor
             JOIN system_role_bindings actor_binding ON actor_binding.account_id = actor.id
             JOIN system_iam_role_permissions permission ON permission.role_id = actor_binding.role_id
             WHERE actor.id = ?1 AND actor.status = 'active' AND actor.closed_at IS NULL
               AND actor_binding.revoked_at IS NULL
               AND (actor_binding.resource_type IS NULL OR
                 (actor_binding.resource_type = ?2 AND actor_binding.resource_id = ?3))
               AND permission.permission_key = ?4
               AND (?5 IS NULL OR NOT EXISTS (
                 SELECT 1 FROM system_iam_role_permissions target_permission
                 WHERE target_permission.role_id = ?5 AND NOT EXISTS (
                   SELECT 1 FROM system_role_bindings actor_role
                   JOIN system_iam_role_permissions actor_permission
                     ON actor_permission.role_id = actor_role.role_id
                   WHERE actor_role.account_id = ?1 AND actor_role.revoked_at IS NULL
                     AND (actor_role.resource_type IS NULL OR
                       (actor_role.resource_type = ?2 AND actor_role.resource_id = ?3))
                     AND actor_permission.permission_key = target_permission.permission_key
                 )
               ))
           ) AS allowed`,
        )
        .bind(
          input.actorAccountId,
          input.resourceType,
          input.resourceId,
          input.requiredPermissionKey,
          input.targetRoleId ?? null,
        )
        .first<{ allowed: number }>()
      return row?.allowed === 1
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("System scoped role authorization failed")
    }
  }

  async execute(): Promise<
    "revoked" | "already_revoked" | "forbidden" | "not_found" | "last_manager" | Error
  > {
    const { c } = this
    const now = c.now.getTime()
    try {
      const statements = [
        c.database
          .prepare(
            `SELECT CASE WHEN EXISTS (
               SELECT 1 FROM system_accounts actor
               JOIN system_role_bindings actor_binding ON actor_binding.account_id = actor.id
               JOIN system_iam_role_permissions permission ON permission.role_id = actor_binding.role_id
               WHERE actor.id = ?1 AND actor.status = 'active' AND actor.closed_at IS NULL
                 AND actor_binding.revoked_at IS NULL
                 AND (actor_binding.resource_type IS NULL OR
                   (actor_binding.resource_type = ?2 AND actor_binding.resource_id = ?3))
                 AND permission.permission_key = ?4
                 AND NOT EXISTS (
                   SELECT 1 FROM system_iam_role_permissions target_permission
                   WHERE target_permission.role_id = ?5 AND NOT EXISTS (
                     SELECT 1 FROM system_role_bindings actor_role
                     JOIN system_iam_role_permissions actor_permission
                       ON actor_permission.role_id = actor_role.role_id
                     WHERE actor_role.account_id = ?1 AND actor_role.revoked_at IS NULL
                       AND (actor_role.resource_type IS NULL OR
                         (actor_role.resource_type = ?2 AND actor_role.resource_id = ?3))
                       AND actor_permission.permission_key = target_permission.permission_key
                   )
                 )
             ) THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(
            c.actorAccountId,
            c.resourceType,
            c.resourceId,
            c.requiredPermissionKey,
            c.binding.roleId,
          ),
        c.database
          .prepare(
            `UPDATE system_role_bindings SET revoked_at = ?2
             WHERE id = ?1 AND account_id = ?3 AND resource_type = ?4 AND resource_id = ?5
               AND revoked_at IS NULL AND created_at <= ?2`,
          )
          .bind(c.binding.id, now, c.targetAccountId, c.resourceType, c.resourceId),
        c.database.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        c.database
          .prepare(
            `UPDATE system_accounts
             SET token_version = token_version + 1, updated_at = max(updated_at, ?2)
             WHERE id = ?1 AND token_version < 9007199254740991`,
          )
          .bind(c.targetAccountId, now),
        c.database.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        c.database
          .prepare(
            `SELECT CASE WHEN NOT EXISTS (
               SELECT 1 FROM system_iam_role_permissions
               WHERE role_id = ?1 AND permission_key = ?2
             ) OR EXISTS (
               SELECT 1 FROM system_role_bindings remaining
               JOIN system_accounts account ON account.id = remaining.account_id
               JOIN system_iam_role_permissions permission ON permission.role_id = remaining.role_id
               WHERE remaining.resource_type = ?3 AND remaining.resource_id = ?4
                 AND remaining.revoked_at IS NULL AND account.status = 'active'
                 AND account.closed_at IS NULL AND permission.permission_key = ?2
             ) THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
          )
          .bind(c.binding.roleId, c.managerPermissionKey, c.resourceType, c.resourceId),
        ...c.auditStatements,
      ]
      const results = await c.database.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? "revoked"
        : new Error("System scoped role revocation batch did not succeed")
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "last_manager"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        const current = await c.database
          .prepare("SELECT revoked_at FROM system_role_bindings WHERE id = ?1")
          .bind(c.binding.id)
          .first<{ revoked_at: number | null }>()
        return current === null
          ? "not_found"
          : current.revoked_at !== null
            ? "already_revoked"
            : "forbidden"
      }
      return caught instanceof Error ? caught : new Error("System scoped role revocation failed")
    }
  }
}
