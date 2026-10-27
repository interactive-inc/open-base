const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
/** 認証アプリの多くが既定で読む 6 桁に固定する。 */
export const SYSTEM_TOTP_DIGITS = 6

/** RFC 6238 TOTP（HMAC-SHA1）で、指定した区間のコードを作る。 */
export async function generateSystemTotpCode(
  secret: string,
  step: number,
): Promise<string | Error> {
  const key = decodeBase32(secret)
  if (key instanceof Error) return key
  if (!Number.isSafeInteger(step) || step < 0) return new Error("TOTP step is invalid")

  try {
    const counter = new Uint8Array(8)
    new DataView(counter.buffer).setBigUint64(0, BigInt(step))
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"],
    )
    const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counter))
    const offset = (digest[digest.length - 1] ?? 0) & 0x0f
    const binary =
      (((digest[offset] ?? 0) & 0x7f) << 24) |
      ((digest[offset + 1] ?? 0) << 16) |
      ((digest[offset + 2] ?? 0) << 8) |
      (digest[offset + 3] ?? 0)

    return String(binary % 10 ** SYSTEM_TOTP_DIGITS).padStart(SYSTEM_TOTP_DIGITS, "0")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to generate TOTP code")
  }
}

function decodeBase32(input: string): Uint8Array<ArrayBuffer> | Error {
  const normalized = input.replace(/=+$/, "").toUpperCase()
  if (normalized.length === 0) return new Error("TOTP secret is empty")

  const bytes: Array<number> = []
  let bits = 0
  let value = 0

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index === -1) return new Error("TOTP secret is not base32")
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }

  return new Uint8Array(bytes)
}
