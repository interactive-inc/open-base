import type { PermissionKey } from "@/lib/api/types/permission-key"

/** System Role Binding を変更できる正規 System permission。 */
export function canAssignRoles(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("system:admin") || permissions.includes("iam:write")
}
