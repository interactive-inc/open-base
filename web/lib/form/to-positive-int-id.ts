/**
 * FormData の ID 値を正の整数に変換する。10進の正整数のみ通し、それ以外は null。
 * 未入力（Number(null)=0）・0・負値・小数・全角・hex/指数表記（0x10・1e3）・桁あふれを弾く。
 */
export function toPositiveIntId(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()

  if (/^\d+$/.test(trimmed) === false) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
