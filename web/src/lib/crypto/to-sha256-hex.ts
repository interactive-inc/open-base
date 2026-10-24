/**
 * 文字列を SHA-256 でハッシュ化し、小文字16進の64文字文字列にする
 */
export async function toSha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
