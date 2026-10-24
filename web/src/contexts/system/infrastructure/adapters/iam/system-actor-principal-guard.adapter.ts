import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = SystemD1Context

/**
 * 機械Principalを操作するactorが、対象PrincipalのAccountより強い権限を得られないことを
 * 書込と同じbatch内で検査する。system:adminか、iam:writeに加えて対象Accountの全permissionを
 * 持つ場合だけ通し、それ以外はbatch全体を中断する。
 */
export class SystemActorPrincipalGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(actorAccountId: AccountId, principalId: string): D1PreparedStatement {
    return this.c.env.DB.prepare(
      `WITH actor_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_accounts account
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.id = ?1
           AND account.status = 'active'
           AND binding.resource_type IS NULL
           AND binding.revoked_at IS NULL
       ), target_permissions AS (
         SELECT DISTINCT permission.permission_key AS key
         FROM system_principals principal
         INNER JOIN system_role_bindings binding ON binding.account_id = principal.account_id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE principal.id = ?2
           AND binding.revoked_at IS NULL
       )
       SELECT CASE WHEN
         EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'system:admin')
         OR (
           EXISTS (SELECT 1 FROM actor_permissions WHERE key = 'iam:write')
           AND NOT EXISTS (
             SELECT 1 FROM target_permissions target
             WHERE NOT EXISTS (
               SELECT 1 FROM actor_permissions actor WHERE actor.key = target.key
             )
           )
         )
       THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
    ).bind(actorAccountId, principalId)
  }
}
