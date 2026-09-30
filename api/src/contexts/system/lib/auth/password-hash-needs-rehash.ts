const ITERATIONS = 100_000
const MAX_ITERATIONS = 2_000_000
const SALT_BYTES = 16
const HASH_BYTES = 32

/** 保存済みpassword hashが現行parameterで再hashを要するか判定する。 */
export function passwordHashNeedsRehash(stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return true

  const iterations = Number.parseInt(parts[2]!, 10)
  if (!Number.isFinite(iterations) || iterations <= 0 || iterations > MAX_ITERATIONS) return true

  try {
    return (
      atob(parts[3]!).length !== SALT_BYTES ||
      atob(parts[4]!).length !== HASH_BYTES ||
      iterations < ITERATIONS
    )
  } catch {
    return true
  }
}
