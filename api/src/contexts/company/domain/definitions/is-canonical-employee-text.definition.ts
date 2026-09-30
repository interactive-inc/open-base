/** nullableなEmployee profile文字列が空値表現、長さ、制御文字の制約を満たすかを返す。 */
export function isCanonicalEmployeeText(value: string | null, maximumLength: number): boolean {
  if (value === null) return true
  if (value.length < 1 || value.length > maximumLength || value.trim() !== value) return false

  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f)) return false
  }

  return true
}
