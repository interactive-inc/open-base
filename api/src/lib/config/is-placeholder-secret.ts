/** .dev.vars.example が配る例示値の接尾辞。公開リポジトリなので値そのものが既知になる。 */
const PLACEHOLDER_SUFFIX = "-change-me"

/**
 * 設定値が公開済みの例示値のままかを判定する。
 *
 * このリポジトリは公開されているため、.dev.vars.example に載っている秘密値は
 * 誰でも読める。運用者が example をコピーしたまま本番に置くと、鍵を知っている
 * 第三者がトークンを偽造したり機械用エンドポイントを叩ける。
 */
export function isPlaceholderSecret(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  return value.endsWith(PLACEHOLDER_SUFFIX)
}
