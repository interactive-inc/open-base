/** 生成側（generate）と同じ、読み違えやすい文字を除いた小文字と数字。 */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const CODE_LENGTH = 10

/** 区切りと空白、大文字小文字の揺れを落とす。復旧コードの形でなければ null を返す。 */
export function normalizeSystemTotpRecoveryCode(input: string): string | null {
  const normalized = input.toLowerCase().replace(/[\s-]/g, "")
  if (normalized.length !== CODE_LENGTH) return null
  if ([...normalized].some((character) => !ALPHABET.includes(character))) return null

  return normalized
}
