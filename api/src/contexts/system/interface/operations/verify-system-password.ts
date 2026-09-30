import { verifyPassword } from "@system/lib/auth/verify-password"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function verifySystemPassword(...input: Parameters<typeof verifyPassword>) {
  return verifyPassword(...input)
}
