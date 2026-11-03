/** 自己付与の拒否を、すべてのロール割当の入口で共有する。 */
export function isSelfRoleBindingAssignment(
  actorAccountId: string,
  targetAccountId: string,
): boolean {
  return actorAccountId === targetAccountId
}
