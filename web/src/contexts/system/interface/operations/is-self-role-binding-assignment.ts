import { isSelfRoleBindingAssignment } from "@system/domain/policies/role-binding-assignment.policy"

/** 別の入口にも同じ自己付与の判定を公開する。 */
export function isSelfSystemRoleBindingAssignment(
  actorAccountId: string,
  targetAccountId: string,
): boolean {
  return isSelfRoleBindingAssignment(actorAccountId, targetAccountId)
}
