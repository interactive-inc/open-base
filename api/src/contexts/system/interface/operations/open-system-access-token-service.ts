import { AccessTokenService } from "@system/lib/auth/access-token-service"

/** 製品側が選択した用途・issuer・audienceに限定された署名と検証口を開く。 */
export function openSystemAccessTokenService(
  input: ConstructorParameters<typeof AccessTokenService>[0],
) {
  return new AccessTokenService(input)
}
