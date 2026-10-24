import { iamRoleIdSchema } from "@system/domain/schemas/iam/iam-role.schema"
import { SystemRoleCatalogRepository } from "@system/infrastructure/repositories/iam/system-role-catalog.repository"

export type SystemRoleSummary = Readonly<{
  id: string
  resourceType: string | null
  name: string
  kind: "managed" | "custom"
  permissionKeys: ReadonlyArray<string>
}>

/** 他contextにSystem roleのscopeと権限を公開する読み取り契約。 */
export async function readSystemRoleSummary(
  input: Readonly<{ database: D1Database; roleId: string }>,
): Promise<SystemRoleSummary | null | Error> {
  const roleId = iamRoleIdSchema.safeParse(input.roleId)
  if (!roleId.success) return null

  const role = await new SystemRoleCatalogRepository({ env: { DB: input.database } }).find(
    roleId.data,
  )
  if (role instanceof Error || role === null) return role
  return Object.freeze({
    id: role.id,
    resourceType: role.resourceType,
    name: role.name,
    kind: role.kind,
    permissionKeys: Object.freeze([...role.permissionKeys]),
  })
}
