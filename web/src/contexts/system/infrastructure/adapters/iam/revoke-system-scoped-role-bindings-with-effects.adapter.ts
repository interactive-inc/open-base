import { RevokeSystemScopedRoleBindingAdapter } from "@system/infrastructure/adapters/iam/revoke-system-scoped-role-binding.adapter"

type Context = Readonly<{
  database: D1Database
  actorAccountId: string
  targetAccountId: string
  resourceType: string
  resourceId: string
  requiredPermissionKey: string
  managerPermissionKey: string
  bindingIds: ReadonlyArray<string>
  invitationRelatedResourceIds: ReadonlyArray<string>
  invitationIds: ReadonlyArray<string>
  now: Date
  effects: ReadonlyArray<D1PreparedStatement>
  auditStatements: ReadonlyArray<D1PreparedStatement>
  invitationAuditStatements: ReadonlyArray<D1PreparedStatement>
}>

/** 外部effectも含むD1 batchで、System role履歴と監査を原子的に確定する。 */
export class RevokeSystemScopedRoleBindingsWithEffectsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(): Promise<"revoked" | "forbidden" | "conflict" | "last_manager" | Error> {
    const { c } = this
    const bindingIds = JSON.stringify(c.bindingIds)
    const invitationIds = JSON.stringify(c.invitationIds)
    const relatedResourceIds = JSON.stringify(c.invitationRelatedResourceIds)
    const now = c.now.getTime()
    const statements: D1PreparedStatement[] = [
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
         ) AND NOT EXISTS (
           SELECT 1 FROM system_role_bindings current
           WHERE current.account_id = ?2 AND current.resource_type = ?3 AND current.resource_id = ?4
             AND current.revoked_at IS NULL
             AND current.id NOT IN (SELECT value FROM json_each(?6))
         ) AND NOT EXISTS (
           SELECT 1 FROM json_each(?6) expected
           WHERE NOT EXISTS (
             SELECT 1 FROM system_role_bindings current
             WHERE current.id = expected.value AND current.account_id = ?2
               AND current.resource_type = ?3 AND current.resource_id = ?4
               AND current.revoked_at IS NULL
           )
         ) AND NOT EXISTS (
           SELECT 1 FROM system_role_bindings current
           JOIN system_iam_role_permissions target_permission ON target_permission.role_id = current.role_id
           WHERE current.id IN (SELECT value FROM json_each(?6))
             AND NOT EXISTS (
               SELECT 1 FROM system_role_bindings actor_role
               JOIN system_iam_role_permissions possessed ON possessed.role_id = actor_role.role_id
               WHERE actor_role.account_id = ?1 AND actor_role.revoked_at IS NULL
                 AND (actor_role.resource_type IS NULL OR
                   (actor_role.resource_type = ?3 AND actor_role.resource_id = ?4))
                 AND possessed.permission_key = target_permission.permission_key
             )
         ) AND (?1 <> ?2 OR json_array_length(?6) = 0)
         THEN 1 ELSE json_extract('', '$') END AS ok`,
        )
        .bind(
          c.actorAccountId,
          c.targetAccountId,
          c.resourceType,
          c.resourceId,
          c.requiredPermissionKey,
          bindingIds,
        ),
      ...(c.invitationRelatedResourceIds.length === 0
        ? []
        : [
            c.database
              .prepare(
                `SELECT CASE WHEN NOT EXISTS (
                 SELECT 1 FROM system_account_invitations invitation
                 WHERE invitation.resource_type = ?1 AND invitation.resource_id = ?2
                   AND invitation.related_resource_id IN (SELECT value FROM json_each(?3))
                   AND invitation.accepted_by_account_id IS NULL AND invitation.revoked_at IS NULL
                   AND invitation.expires_at > ?4 AND invitation.created_at <= ?4
                   AND (invitation.id NOT IN (SELECT value FROM json_each(?5)) OR EXISTS (
                     SELECT 1 FROM system_iam_role_permissions target_permission
                     WHERE target_permission.role_id = invitation.role_id AND NOT EXISTS (
                       SELECT 1 FROM system_role_bindings actor_role
                       JOIN system_iam_role_permissions actor_permission
                         ON actor_permission.role_id = actor_role.role_id
                       WHERE actor_role.account_id = ?6 AND actor_role.revoked_at IS NULL
                         AND (actor_role.resource_type IS NULL OR
                           (actor_role.resource_type = ?1 AND actor_role.resource_id = ?2))
                         AND actor_permission.permission_key = target_permission.permission_key
                     )
                   ))
               ) AND NOT EXISTS (
                 SELECT 1 FROM json_each(?5) expected
                 WHERE NOT EXISTS (
                   SELECT 1 FROM system_account_invitations invitation
                   WHERE invitation.id = expected.value
                     AND invitation.resource_type = ?1 AND invitation.resource_id = ?2
                     AND invitation.related_resource_id IN (SELECT value FROM json_each(?3))
                     AND invitation.accepted_by_account_id IS NULL AND invitation.revoked_at IS NULL
                     AND invitation.expires_at > ?4 AND invitation.created_at <= ?4
                 )
               ) THEN 1 ELSE json_extract('', '$') END AS ok`,
              )
              .bind(
                c.resourceType,
                c.resourceId,
                relatedResourceIds,
                now,
                invitationIds,
                c.actorAccountId,
              ),
            c.database
              .prepare(
                `UPDATE system_account_invitations SET revoked_at = ?1, updated_at = max(updated_at, ?1)
                 WHERE id IN (SELECT value FROM json_each(?2))
                   AND resource_type = ?3 AND resource_id = ?4
                   AND related_resource_id IN (SELECT value FROM json_each(?5))
                   AND accepted_by_account_id IS NULL AND revoked_at IS NULL
                   AND expires_at > ?1 AND created_at <= ?1`,
              )
              .bind(now, invitationIds, c.resourceType, c.resourceId, relatedResourceIds),
            c.database
              .prepare(
                "SELECT CASE WHEN changes() = ?1 THEN 1 ELSE json_extract('', '$') END AS ok",
              )
              .bind(c.invitationIds.length),
            ...c.invitationAuditStatements,
          ]),
      ...c.effects,
      c.database
        .prepare(
          `UPDATE system_role_bindings SET revoked_at = ?3
         WHERE account_id = ?1 AND id IN (SELECT value FROM json_each(?2))
           AND revoked_at IS NULL AND created_at <= ?3`,
        )
        .bind(c.targetAccountId, bindingIds, now),
      c.database
        .prepare("SELECT CASE WHEN changes() = ?1 THEN 1 ELSE json_extract('', '$') END AS ok")
        .bind(c.bindingIds.length),
    ]
    if (c.bindingIds.length > 0) {
      statements.push(
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
             SELECT 1 FROM system_role_bindings old
             JOIN system_iam_role_permissions permission ON permission.role_id = old.role_id
             WHERE old.id IN (SELECT value FROM json_each(?1))
               AND permission.permission_key = ?4
           ) OR EXISTS (
             SELECT 1 FROM system_role_bindings remaining
             JOIN system_accounts account ON account.id = remaining.account_id
             JOIN system_iam_role_permissions permission ON permission.role_id = remaining.role_id
             WHERE remaining.resource_type = ?2 AND remaining.resource_id = ?3
               AND remaining.revoked_at IS NULL AND account.status = 'active'
               AND account.closed_at IS NULL AND permission.permission_key = ?4
           ) THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
          )
          .bind(bindingIds, c.resourceType, c.resourceId, c.managerPermissionKey),
        ...c.auditStatements,
      )
    }
    try {
      const results = await c.database.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? "revoked"
        : new Error("System scoped role batch did not succeed")
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow"))
        return "last_manager"
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        const allowed = await RevokeSystemScopedRoleBindingAdapter.canActorManage({
          database: c.database,
          actorAccountId: c.actorAccountId,
          resourceType: c.resourceType,
          resourceId: c.resourceId,
          requiredPermissionKey: c.requiredPermissionKey,
        })
        if (allowed instanceof Error) return allowed
        return allowed ? "conflict" : "forbidden"
      }
      return caught instanceof Error ? caught : new Error("System scoped role batch failed")
    }
  }
}
