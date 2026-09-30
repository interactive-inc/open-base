import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"

/** System自身の固定profileでAccountのaccess tokenを発行する。 */
export function issueSystemAccountAccessToken(
  secret: string,
  input: Parameters<SystemAccessTokenIssuer["issue"]>[0],
) {
  return new SystemAccessTokenIssuer(secret).issue(input)
}
