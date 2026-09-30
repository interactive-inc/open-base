import type { PermissionKey } from "@/lib/api/types/permission-key"

const WORKFLOW_REPAIR_PERMISSIONS = ["application:read:all", "application_template:manage"] as const

/**
 * ワークフロー修復は全社申請の閲覧とテンプレート管理の両方を要求する。
 * UI の導線と Server Action で同じ条件を使い、最終判定は API に委ねる。
 */
export function canManageWorkflowRepairs(permissions: ReadonlyArray<PermissionKey>): boolean {
  const permissionSet = new Set(permissions)

  return WORKFLOW_REPAIR_PERMISSIONS.every((permission) => permissionSet.has(permission))
}
