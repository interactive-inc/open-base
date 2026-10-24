/**
 * 再認証後の戻り先を、同じ origin の画面の path だけに限定する。
 * 別 origin へ飛ばす形（`//host`、`/\host`、scheme 付き）は null にする。
 */
export function resolveStepUpReturnPath(value: string | null): string | null {
  if (value === null || value.length === 0 || value.length > 512) return null
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null
  if (/[\u0000-\u001f]/u.test(value)) return null
  return value
}
