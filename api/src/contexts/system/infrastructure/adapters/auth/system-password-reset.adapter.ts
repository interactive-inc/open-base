import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

type ResetProps = Readonly<{
  actorAccountId: AccountId
  targetAccountId: AccountId
  identityId: IdentityId
  passwordHash: string
  now: Date
  auditStatements: ReadonlyArray<D1PreparedStatement>
}>

export type SystemPasswordResetMutation = "reset" | "not_found" | "forbidden"
type Context = SystemD1Context

/** password credential変更とAccountEntity Session失効を同じSystem transactionで保存する。 */
export class SystemPasswordResetAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findIdentityId(accountId: AccountId): Promise<IdentityId | null | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT id
         FROM system_identity_bindings
         WHERE account_id = ?1
           AND provider = 'password'
           AND activated_at IS NOT NULL
           AND revoked_at IS NULL
         ORDER BY created_at, id
         LIMIT 2`,
      )
        .bind(accountId)
        .all<Readonly<{ id: string }>>()
      if (!rows.success) return new Error("failed to read System password Identity")
      if (rows.results.length === 0) return null
      if (rows.results.length !== 1) {
        return new Error("System AccountEntity has multiple active password Identities")
      }
      const identityId = zIdentityId.safeParse(rows.results[0]?.id)

      return identityId.success ? identityId.data : identityId.error
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System password Identity")
    }
  }

  async reset(props: ResetProps): Promise<SystemPasswordResetMutation | Error> {
    try {
      const statements = [
        this.prepareActorAccountGuard(props.actorAccountId, props.targetAccountId),
        this.c.env.DB.prepare(
          `UPDATE system_password_credentials
           SET password_hash = ?2,
               changed_at = max(changed_at + 1, ?4),
               updated_at = max(updated_at + 1, ?4)
           WHERE identity_id = ?1
             AND EXISTS (
               SELECT 1 FROM system_identity_bindings
               WHERE id = ?1
                 AND account_id = ?3
                 AND provider = 'password'
                 AND activated_at IS NOT NULL
                 AND revoked_at IS NULL
             )`,
        ).bind(props.identityId, props.passwordHash, props.targetAccountId, props.now.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        this.c.env.DB.prepare(
          `UPDATE system_accounts
           SET token_version = token_version + 1,
               updated_at = max(updated_at, ?2)
           WHERE id = ?1 AND token_version < 9007199254740991`,
        ).bind(props.targetAccountId, props.now.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok",
        ),
        ...props.auditStatements,
      ]
      const executions = await this.c.env.DB.batch(statements)
      if (executions.length !== statements.length || executions.some((entry) => !entry.success)) {
        return new Error("System password reset batch did not succeed")
      }

      return "reset"
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return "forbidden"
      }
      if (caught instanceof Error && caught.message.includes("malformed JSON")) {
        const currentIdentityId = await this.findIdentityId(props.targetAccountId)
        if (currentIdentityId === null) return "not_found"
        if (currentIdentityId instanceof Error) return currentIdentityId

        return new Error("System password credential is inconsistent", { cause: caught })
      }

      return caught instanceof Error ? caught : new Error("failed to reset System password")
    }
  }

  private prepareActorAccountGuard(
    actorAccountId: AccountId,
    targetAccountId: AccountId,
  ): D1PreparedStatement {
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
         FROM system_role_bindings binding
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE binding.account_id = ?2 AND binding.revoked_at IS NULL
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
    ).bind(actorAccountId, targetAccountId)
  }
}
