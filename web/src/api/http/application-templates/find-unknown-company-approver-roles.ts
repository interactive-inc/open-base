import { openSystemRoleCatalog } from "@system/interface/operations/open-system-role-catalog"

export async function findUnknownCompanyApproverRoles(
  database: D1Database,
  roleKeys: ReadonlyArray<string>,
): Promise<ReadonlyArray<string> | Error> {
  const uniqueRoleKeys = [...new Set(roleKeys)]
  if (uniqueRoleKeys.length === 0) return []

  const roles = await openSystemRoleCatalog({ env: { DB: database } }).findMany()
  if (roles instanceof Error) return roles
  const existingKeys = new Set(roles.map((role) => role.key.replace(/^company:/u, "")))

  return uniqueRoleKeys.filter((roleKey) => existingKeys.has(roleKey) === false)
}
