/**
 * 辞書引き純関数。翻訳キーは日本語ソース文字列そのもの。
 * `dictionary` にキーが無ければキーをそのまま返す（= 日本語へのフォールバック）。
 * `vars` を渡すと `{name}` プレースホルダーを埋め込む。未定義の変数はプレースホルダーのまま残す。
 */
export function translate(
  dictionary: Record<string, string>,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const template = dictionary[key] ?? key

  if (vars === undefined) {
    return template
  }

  return template.replace(/\{(\w+)\}/g, (_, name) => {
    const value = vars[name]

    return value === undefined ? `{${name}}` : String(value)
  })
}
