import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 組織図の部署ノードを作成・変更・削除できる権限（org:manage）を持つか判定する（api の canManageOrg と同一基準）。 */
export function canManageOrg(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("org:manage")
}
