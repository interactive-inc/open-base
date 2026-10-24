import { createScopedPermissionChecker } from "@system/domain/policies/scoped-permission.policy"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function createSystemScopedPermissionChecker(
  ...input: Parameters<typeof createScopedPermissionChecker>
) {
  return createScopedPermissionChecker(...input)
}
