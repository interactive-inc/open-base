import { getAccountSessionRejection } from "@system/domain/policies/account-session.policy"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function readSystemAccountSessionRejection(
  ...input: Parameters<typeof getAccountSessionRejection>
) {
  return getAccountSessionRejection(...input)
}
