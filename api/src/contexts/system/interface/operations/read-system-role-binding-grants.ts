import { roleBindingIdSchema } from "@system/domain/schemas/iam/role-binding.schema"

/** Role割当が保持するSystem permissionを読む。割当不在時は空集合を返す。 */
export async function readSystemRoleBindingGrants(
  database: D1Database,
  bindingId: string,
): Promise<ReadonlyArray<string> | Error> {
  const parsed = roleBindingIdSchema.safeParse(bindingId)
  if (!parsed.success) return []
  try {
    const rows = await database
      .prepare(
        `SELECT grants.permission_key
         FROM system_role_bindings AS binding
         LEFT JOIN system_iam_role_permissions AS grants ON grants.role_id = binding.role_id
         WHERE binding.id = ?1 ORDER BY grants.permission_key`,
      )
      .bind(parsed.data)
      .all<{ permission_key: string | null }>()
    const permissionKeys: string[] = []
    for (const row of rows.results) {
      if (row.permission_key === null) continue
      if (row.permission_key.length < 3 || row.permission_key.length > 100) {
        return new Error("Invalid System Role binding permission")
      }
      permissionKeys.push(row.permission_key)
    }
    return permissionKeys
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System Role binding grants lookup failed")
  }
}
