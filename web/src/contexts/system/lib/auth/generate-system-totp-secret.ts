const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const SECRET_BYTE_LENGTH = 20

/** 160 bitの乱数を、認証アプリへ渡すbase32（paddingなし）で返す。 */
export function generateSystemTotpSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTE_LENGTH)
  crypto.getRandomValues(bytes)

  return encodeBase32(bytes)
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ""

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]

  return output
}
