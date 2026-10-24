import { toUnpaddedBase64Url } from "@system/lib/auth/to-unpadded-base64-url"

/** RFC 7636のS256方式でverifierからchallengeを導出する。 */
export async function toPkceS256Challenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))

  return toUnpaddedBase64Url(new Uint8Array(digest))
}
