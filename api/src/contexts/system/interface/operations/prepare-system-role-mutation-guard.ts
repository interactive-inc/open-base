import { SystemRoleMutationGuardAdapter } from "@system/infrastructure/adapters/iam/system-role-mutation-guard.adapter"

/** ロールの保存と同じbatchで、保存前後のいずれかでrootを含む変更を保護する文を公開する。 */
export function prepareSystemRoleMutationGuard(
  input: Readonly<{
    database: D1Database
    roleId: string
    actorAccountId: string
    permissionKeys: ReadonlyArray<string>
  }>,
): D1PreparedStatement {
  return new SystemRoleMutationGuardAdapter(input).prepare()
}
