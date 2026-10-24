import { readBearerAuthorization } from "@system/interface/operations/bearer-authorization"

const canonicalAccessTokenPattern = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/u

export function readOidcAccessToken(authorizationHeader: string | null): string | null {
  const authorization = readBearerAuthorization(authorizationHeader ?? undefined)

  return authorization.kind === "token" && canonicalAccessTokenPattern.test(authorization.token)
    ? authorization.token
    : null
}
