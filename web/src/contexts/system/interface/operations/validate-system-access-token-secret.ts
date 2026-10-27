import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"

/** Systemが所有する値を検証・生成する。 */
export function validateSystemAccessTokenSecret(
  ...input: Parameters<typeof SystemAccessTokenSecretValue.create>
) {
  return SystemAccessTokenSecretValue.create(...input)
}
