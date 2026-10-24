import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

const TOKEN_PATTERN = /^[0-9a-f]{64}$/

/** 招待tokenをhashにする。形式が違うtokenはDBを引かずに null にする。 */
export async function hashSystemPasskeyEnrollmentToken(
  token: string,
): Promise<string | null | Error> {
  if (!TOKEN_PATTERN.test(token)) return null
  return await new SystemPrincipalSecretService().hashRawSecret(token)
}
