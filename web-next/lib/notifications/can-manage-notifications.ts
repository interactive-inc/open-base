import type { PermissionKey } from "@/lib/api/types/permission-key"

/** 通知を作成・送信できる権限（notification:send）を持つか判定する（api の canSendNotification と同一基準）。 */
export function canManageNotifications(permissions: ReadonlyArray<PermissionKey>): boolean {
  return permissions.includes("notification:send")
}
