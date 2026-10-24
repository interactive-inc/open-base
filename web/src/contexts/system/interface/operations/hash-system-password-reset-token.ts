import { hashPasswordResetToken } from "@system/lib/auth/hash-password-reset-token"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function hashSystemPasswordResetToken(...input: Parameters<typeof hashPasswordResetToken>) {
  return hashPasswordResetToken(...input)
}
