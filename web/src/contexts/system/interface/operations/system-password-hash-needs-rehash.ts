import { passwordHashNeedsRehash } from "@system/lib/auth/password-hash-needs-rehash"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function systemPasswordHashNeedsRehash(
  ...input: Parameters<typeof passwordHashNeedsRehash>
) {
  return passwordHashNeedsRehash(...input)
}
