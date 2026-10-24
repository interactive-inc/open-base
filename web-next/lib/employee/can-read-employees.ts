import type { PermissionKey } from "@/lib/api/types/permission-key"

/** メール・在籍状況・ロールを含む従業員台帳を閲覧できるか判定する。 */
export function canReadEmployees(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("employee:read")
}
