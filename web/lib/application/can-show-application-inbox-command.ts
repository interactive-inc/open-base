import type { PermissionKey } from "@/lib/api/types/permission-key"

/**
 * 固定 permission を持つ従来の承認者に加え、ワークフロー解決で候補になった利用者にも
 * pending 件数がある間は承認 inbox へのコマンド導線を表示する。
 */
export function canShowApplicationInboxCommand(
  permissions: ReadonlyArray<PermissionKey>,
  pendingApplicationCount: number,
): boolean {
  return permissions.includes("application:approve") || pendingApplicationCount > 0
}
