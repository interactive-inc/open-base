/**
 * 文字列の SHA-256 を 16 進小文字で返す
 */
export async function lifecycleSha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
