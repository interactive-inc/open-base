/** 業務レコード ID として受け付ける形。整数 ID と UUID の両方を含む。 */
export const ENTITY_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z_-]{0,63}$/

/**
 * FormData や route param の業務レコード ID を文字列として読む。
 * 現在の整数 ID と移行後の UUID の両方を通し、空値・空白・区切り文字を含む値・過長な値は null にする。
 * 数値への変換はしない。API が数値を要求する間の変換は `lib/api` の境界で行う。
 */
export function toEntityId(value: FormDataEntryValue | string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  return ENTITY_ID_PATTERN.test(trimmed) ? trimmed : null
}
