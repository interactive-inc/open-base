import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 役職マスタの登録・更新・削除を行える権限（position:manage）を持つか判定する（api の canManagePositions と同一基準）。 */
export function canManagePositions(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("position:manage")
}
