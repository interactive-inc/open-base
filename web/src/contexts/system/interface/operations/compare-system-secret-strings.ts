import { timingSafeStringEqual } from "@system/lib/auth/timing-safe-string-equal"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function compareSystemSecretStrings(...input: Parameters<typeof timingSafeStringEqual>) {
  return timingSafeStringEqual(...input)
}
