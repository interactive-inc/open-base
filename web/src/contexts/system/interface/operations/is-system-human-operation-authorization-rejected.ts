import { SystemHumanOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-human-operation-authorization.adapter"

/** 保存時の認可再照合が拒否した失敗かを判定する。 */
export function isSystemHumanOperationAuthorizationRejected(cause: unknown): boolean {
  return SystemHumanOperationAuthorizationAdapter.rejected(cause)
}
