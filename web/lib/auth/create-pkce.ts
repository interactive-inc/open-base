export type Pkce = {
  verifier: string
  challenge: string
}

/**
 * RFC 7636 S256用のverifierとchallengeを生成する。
 */
export async function createPkce(): Promise<Pkce> {
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))

  return { verifier, challenge: Buffer.from(digest).toString("base64url") }
}
