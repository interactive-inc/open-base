const MAX_ITERATIONS = 2_000_000
const SALT_BYTES = 16
const HASH_BYTES = 32

/** 保存済みPBKDF2 hashを一定時間比較で検証する。 */
export async function verifyPassword(
  password: string,
  stored: string,
  pepper: string,
): Promise<boolean> {
  const parts = stored.split("$")
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false

  const iterations = Number.parseInt(parts[2]!, 10)
  if (!Number.isFinite(iterations) || iterations <= 0 || iterations > MAX_ITERATIONS) return false

  const decode = (encoded: string): Uint8Array<ArrayBuffer> | null => {
    try {
      const binary = atob(encoded)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index)
      }
      return bytes
    } catch {
      return null
    }
  }
  const salt = decode(parts[3]!)
  const expected = decode(parts[4]!)
  if (
    salt === null ||
    salt.length !== SALT_BYTES ||
    expected === null ||
    expected.length !== HASH_BYTES
  ) {
    return false
  }

  const encoder = new TextEncoder()
  const pepperKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const pepperedPassword = new Uint8Array(
    await crypto.subtle.sign("HMAC", pepperKey, encoder.encode(password)),
  )
  const baseKey = await crypto.subtle.importKey(
    "raw",
    pepperedPassword,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      baseKey,
      HASH_BYTES * 8,
    ),
  )
  let difference = actual.length ^ expected.length
  for (let index = 0; index < Math.max(actual.length, expected.length); index += 1) {
    difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0)
  }
  return difference === 0
}
