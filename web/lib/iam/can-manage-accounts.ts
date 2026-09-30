import type { PermissionKey } from "@/lib/api/types/permission-key"

/** System Account を変更できる正規 System permission。 */
export function canManageAccounts(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("system:admin") || permissions.includes("iam:write")
}
