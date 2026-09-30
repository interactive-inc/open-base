import type { RoleBindingResource } from "@system/domain/schemas/iam/role-binding.schema"

/** Role Bindingのresource組を衝突しないcanonical scope keyへ変換する。 */
export function systemResourceScopeKey(resource: RoleBindingResource): string {
  return JSON.stringify([resource.type, resource.id])
}
