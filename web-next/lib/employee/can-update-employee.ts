import type { PermissionKey } from "@/lib/api/types/permission-key"

/** api の canUpdateEmployee と同一基準（permission ベース）。 */
export function canUpdateEmployee(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("employee:update")
}
