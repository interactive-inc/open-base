/**
 * パスパラメータやクエリ由来の文字列・数値を正の整数に変換する。
 * 0・負値・非数・小数・極大の非整数を弾き、不正なら null を返す（#42 / #45 の緩い ID 検証の轍を踏まない）。
 */
export function toPositiveInt(raw: string | number): number | null {
  const parsed = typeof raw === "number" ? raw : Number(raw)

  if (Number.isInteger(parsed) === false) {
    return null
  }

  if (parsed <= 0) {
    return null
  }

  if (parsed > Number.MAX_SAFE_INTEGER) {
    return null
  }

  return parsed
}
