type Context = Readonly<{
  database: D1Database
  roleId: string
  actorAccountId: string
  permissionKeys: ReadonlyArray<string>
}>

/** 保存前後のいずれかでrootを含むロールの変更権限を、保存batchの先頭で再検査する。 */
export class SystemRoleMutationGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(): D1PreparedStatement {
    return this.c.database
      .prepare(
        `SELECT CASE WHEN EXISTS (
         SELECT 1 FROM system_accounts account
         INNER JOIN system_role_bindings binding ON binding.account_id = account.id
         INNER JOIN system_iam_role_permissions permission ON permission.role_id = binding.role_id
         WHERE account.id = ?2
           AND account.status = 'active'
           AND account.closed_at IS NULL
           AND binding.resource_type IS NULL
           AND binding.resource_id IS NULL
           AND binding.revoked_at IS NULL
           AND permission.permission_key = 'system:admin'
       ) OR (?3 = 0 AND NOT EXISTS (
         SELECT 1 FROM system_iam_role_permissions
         WHERE role_id = ?1 AND permission_key = 'system:admin'
       )) THEN 1 ELSE abs(-9223372036854775808) END AS ok`,
      )
      .bind(
        this.c.roleId,
        this.c.actorAccountId,
        Number(this.c.permissionKeys.includes("system:admin")),
      )
  }
}
