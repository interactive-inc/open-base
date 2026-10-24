import { sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { drizzle } from "drizzle-orm/d1"

type Context = Readonly<{
  database: D1Database
  accountId: string
  roleId: string
  resourceType: string
  forbiddenPermissionKeys: ReadonlyArray<string>
}>

/** 条件が変われば必ず一行の SELECT が失敗し、後続の role binding を含む batch を戻す。 */
export class SystemRoleGrantGuardAdapter {
  constructor(private readonly c: Context) {}

  prepare(): BatchItem<"sqlite"> {
    return drizzle(this.c.database)
      .select({
        grantGuard: sql<number>`json_extract(CASE WHEN
        EXISTS (SELECT 1 FROM system_accounts account
          WHERE account.id = ${this.c.accountId} AND account.status = 'active'
            AND account.closed_at IS NULL)
        AND EXISTS (SELECT 1 FROM system_iam_roles role
          WHERE role.id = ${this.c.roleId} AND role.resource_type = ${this.c.resourceType})
        AND NOT EXISTS (SELECT 1 FROM system_iam_role_permissions permission
          WHERE permission.role_id = ${this.c.roleId}
            AND permission.permission_key IN
              (SELECT value FROM json_each(${JSON.stringify(this.c.forbiddenPermissionKeys)})))
        THEN '{"ok":1}' ELSE 'system_role_grant_conflict'
      END, '$.ok')`,
      })
      .from(sql`(SELECT 1) AS system_role_grant_guard`)
  }
}
