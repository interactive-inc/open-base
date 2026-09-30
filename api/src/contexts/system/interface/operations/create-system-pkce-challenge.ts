import { toPkceS256Challenge } from "@system/lib/auth/to-pkce-s256-challenge"

/** Systemが所有する検証・生成処理を公開操作として実行する。 */
export function createSystemPkceChallenge(...input: Parameters<typeof toPkceS256Challenge>) {
  return toPkceS256Challenge(...input)
}
