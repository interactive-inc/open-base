/** 一覧のページング既定値。各ルートで重複定義しないよう集約する。 */
export const DEFAULT_LIST_LIMIT = 50

export const MAX_LIST_LIMIT = 100

/**
 * SQLite/D1 の OFFSET は 32bit 符号付き整数が上限。Number.MAX_SAFE_INTEGER を渡すと
 * ドライバでオーバーフローするため、現実的な上限に丸める。
 */
export const MAX_LIST_OFFSET = 2_147_483_647

/**
 * クエリ文字列を [min, max] の整数に丸める。未指定・非整数・混在文字列・min 未満は fallback。
 * limit は min:1（0 を空一覧でなく既定にフォールバック）、offset は min:0（0 を正当値として維持）。
 * Number.parseInt は "50abc" を 50 と貪欲に解釈するため、Number() + isInteger で厳密に判定する。
 */
export function toBoundedInt(props: {
  raw: string | undefined
  fallback: number
  min: number
  max: number
}): number {
  if (props.raw === undefined) {
    return props.fallback
  }

  const parsed = Number(props.raw)

  if (Number.isInteger(parsed) === false || parsed < props.min) {
    return props.fallback
  }

  return parsed > props.max ? props.max : parsed
}
