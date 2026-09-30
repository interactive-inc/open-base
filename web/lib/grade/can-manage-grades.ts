import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 等級マスタの登録・更新・削除・付与を行える権限（grade:manage）を持つか判定する（api の canManageGrades と同一基準）。 */
export function canManageGrades(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("grade:manage")
}
