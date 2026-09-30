import { toUnpaddedBase64Url } from "@system/lib/auth/to-unpadded-base64-url"

/** OIDC code・token・JWT ID向けの256bit secretを生成する。 */
export function createOidcSecret(): string {
  return toUnpaddedBase64Url(crypto.getRandomValues(new Uint8Array(32)))
}
