import type { SystemDatabase } from "@system/configuration/system-context"
import { sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

export type SystemCredentialIssuanceAuthorityInput = Readonly<{
  actorAccountId: string
  accountId: string
  now: Date
  allowSelf: boolean
}>

type Context = SystemDatabase | D1Database

/** 他人になりすませる資格の発行は、現在有効な全体権限で対象の全権限を包含する場合だけ許す。 */
export class SystemCredentialIssuanceAuthorityAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private query(input: SystemCredentialIssuanceAuthorityInput, abort: boolean) {
    const database = "select" in this.c ? this.c : drizzle(this.c)
    return database
      .select({
        ok: sql<number>`CASE WHEN
        EXISTS (SELECT 1 FROM system_accounts target
          WHERE target.id = ${input.accountId} AND target.status = 'active' AND target.closed_at IS NULL)
        AND EXISTS (SELECT 1 FROM system_accounts actor
          WHERE actor.id = ${input.actorAccountId} AND actor.status = 'active' AND actor.closed_at IS NULL)
        AND (
          (${Number(input.allowSelf)} = 1 AND ${input.actorAccountId} = ${input.accountId})
          OR EXISTS (SELECT 1 FROM system_role_bindings binding
            INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
            INNER JOIN system_iam_roles role ON role.id = binding.role_id
            WHERE binding.account_id = ${input.actorAccountId} AND binding.resource_type IS NULL
              AND role.resource_type IS NULL AND role.created_at <= ${input.now.getTime()}
              AND binding.revoked_at IS NULL AND binding.created_at <= ${input.now.getTime()}
              AND permission.permission_key = 'system:admin')
          OR (
            EXISTS (SELECT 1 FROM system_role_bindings binding
              INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
              INNER JOIN system_iam_roles role ON role.id = binding.role_id
              WHERE binding.account_id = ${input.actorAccountId} AND binding.resource_type IS NULL
                AND role.resource_type IS NULL AND role.created_at <= ${input.now.getTime()}
                AND binding.revoked_at IS NULL AND binding.created_at <= ${input.now.getTime()}
                AND permission.permission_key = 'iam:write')
            AND NOT EXISTS (SELECT 1 FROM system_role_bindings target_binding
              INNER JOIN system_iam_role_permissions target_permission ON target_permission.role_id = target_binding.role_id
              WHERE target_binding.account_id = ${input.accountId} AND target_binding.revoked_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM system_role_bindings actor_binding
                  INNER JOIN system_iam_role_permissions actor_permission ON actor_permission.role_id = actor_binding.role_id
                  INNER JOIN system_iam_roles actor_role ON actor_role.id = actor_binding.role_id
                  WHERE actor_binding.account_id = ${input.actorAccountId} AND actor_binding.resource_type IS NULL
                    AND actor_role.resource_type IS NULL AND actor_role.created_at <= ${input.now.getTime()}
                    AND actor_binding.revoked_at IS NULL AND actor_binding.created_at <= ${input.now.getTime()}
                    AND actor_permission.permission_key = target_permission.permission_key))
          )
        )
        THEN 1 ELSE ${abort ? sql`abs(-9223372036854775808)` : sql`0`} END`,
      })
      .from(sql`(SELECT 1)`)
  }

  async canIssue(input: SystemCredentialIssuanceAuthorityInput): Promise<boolean> {
    if (!Number.isSafeInteger(input.now.getTime())) return false
    const result = await this.query(input, false).get()
    return result?.ok === 1
  }

  /** 同じ保存単位に含め、権限の失効や対象の昇格があれば全変更を取り消す。 */
  prepare(input: SystemCredentialIssuanceAuthorityInput) {
    return this.query(input, true)
  }
}
