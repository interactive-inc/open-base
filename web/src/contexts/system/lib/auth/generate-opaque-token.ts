const TOKEN_BYTE_LENGTH = 32

/** 256 bitの暗号学的乱数から推測不能なopaque tokenを生成する。 */
export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH)
  crypto.getRandomValues(bytes)

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}
