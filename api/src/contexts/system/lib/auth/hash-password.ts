const ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32

/** pepper適用後のpasswordをPBKDF2でhash化する。 */
export async function hashPassword(password: string, pepper: string): Promise<string> {
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
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const baseKey = await crypto.subtle.importKey(
    "raw",
    pepperedPassword,
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  )
  const hash = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
      baseKey,
      HASH_BYTES * 8,
    ),
  )
  const encode = (bytes: Uint8Array<ArrayBuffer>): string => {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
  }

  return `pbkdf2$sha256$${ITERATIONS}$${encode(salt)}$${encode(hash)}`
}
