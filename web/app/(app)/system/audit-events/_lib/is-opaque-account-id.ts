/** Account IDを解釈・正規化せず、Systemのopaque string境界だけを検証する。 */
export function isOpaqueAccountId(value: string): boolean {
  return value.length >= 1 && value.length <= 255
}
