import { SystemActorRoleGuardAdapter } from "@system/infrastructure/adapters/iam/system-actor-role-guard.adapter"

/** ロール変更と同じ保存単位で、操作者の現在の権限と自己付与を検査する。 */
export function prepareSystemActorRoleGuard(
  input: ConstructorParameters<typeof SystemActorRoleGuardAdapter>[0],
): D1PreparedStatement {
  return new SystemActorRoleGuardAdapter(input).prepare()
}
