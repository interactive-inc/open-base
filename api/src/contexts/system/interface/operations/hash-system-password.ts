import { hashPassword } from "@system/lib/auth/hash-password"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function hashSystemPassword(...input: Parameters<typeof hashPassword>) {
  return hashPassword(...input)
}
