import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"

export type SystemRoleGrants = Readonly<{
  resourceType: string | null
  permissionKeys: ReadonlyArray<string>
}>

/** 他contextでの権限付与前に、System Roleのscopeとpermissionを読む。 */
export async function readSystemRoleGrants(
  database: D1Database,
  roleId: string,
): Promise<SystemRoleGrants | null | Error> {
  const parsed = iamRoleIdSchema.safeParse(roleId)
  if (!parsed.success) return null
  try {
    const rows = await database
      .prepare(
        `SELECT roles.resource_type, grants.permission_key
         FROM system_iam_roles AS roles
         LEFT JOIN system_iam_role_permissions AS grants ON grants.role_id = roles.id
         WHERE roles.id = ?1 ORDER BY grants.permission_key`,
      )
      .bind(parsed.data)
      .all<{ resource_type: string | null; permission_key: string | null }>()
    if (rows.results.length === 0) return null
    const resourceType = rows.results[0]?.resource_type ?? null
    if (resourceType !== null && (resourceType.length < 3 || resourceType.length > 100)) {
      return new Error("Invalid System Role scope")
    }
    const permissionKeys: string[] = []
    for (const row of rows.results) {
      if (row.permission_key === null) continue
      if (row.permission_key.length < 3 || row.permission_key.length > 100) {
        return new Error("Invalid System Role permission")
      }
      permissionKeys.push(row.permission_key)
    }
    return { resourceType, permissionKeys }
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System Role grants lookup failed")
  }
}
