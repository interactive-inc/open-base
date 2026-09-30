import type { PermissionKey } from "@/lib/api/types/permission-key"

/** api の canCreateEmployee と同一基準（permission ベース）。 */
export function canCreateEmployee(permissions: ReadonlyArray<PermissionKey>): boolean {
  return (
    permissions.includes("employee:create") &&
    permissions.includes("employee:lifecycle:apply") &&
    permissions.includes("account:manage")
  )
}
