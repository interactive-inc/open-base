import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"

export type SystemRoleRevision = Readonly<{
  id: string
  name: string
  resourceType: string | null
  updatedAt: Date
}>

/** 招待受諾のRole再検査に使うSystem Roleの版とresource scopeを返す。 */
export async function readSystemRoleRevision(
  database: D1Database,
  roleId: string,
): Promise<SystemRoleRevision | null | Error> {
  const parsed = iamRoleIdSchema.safeParse(roleId)
  if (!parsed.success) return null
  try {
    const row = await database
      .prepare(
        `SELECT id, name, resource_type, updated_at
         FROM system_iam_roles WHERE id = ?1`,
      )
      .bind(parsed.data)
      .first<{ id: string; name: string; resource_type: string | null; updated_at: number }>()
    if (row === null) return null
    if (
      row.name.length < 1 ||
      row.name.length > 100 ||
      (row.resource_type !== null &&
        (row.resource_type.length < 3 || row.resource_type.length > 100)) ||
      !Number.isSafeInteger(row.updated_at)
    ) {
      return new Error("Invalid System Role revision")
    }
    return {
      id: row.id,
      name: row.name,
      resourceType: row.resource_type,
      updatedAt: new Date(row.updated_at),
    }
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System Role revision lookup failed")
  }
}
