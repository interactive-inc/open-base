import {
  OidcInvalidTokenApplicationError,
  OidcTemporarilyUnavailableApplicationError,
} from "@/contexts/system/application/errors"
import { OidcScopeValue } from "@system/domain/values/oauth/oidc-scope.value"
import { FindOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/find-oidc-access-token.adapter"
import { SystemOidcIdentityAdapter } from "@system/infrastructure/adapters/identity/system-oidc-identity.adapter"
import { OIDCInvalidTokenError, OIDCTemporarilyUnavailableError } from "@system/interface/errors"
import { readOidcAccessToken } from "@system/interface/authorization/lib/oidc-access-token"
import { systemFactory } from "@/contexts/system/interface/request-environment/system-factory"

// @authorization public - OIDC access token自体をcredentialとして検証する
export const GET = systemFactory.createHandlers(async (c) => {
  const accessToken = readOidcAccessToken(c.req.header("Authorization") ?? null)
  const issuer = c.var.oidcIssuerConfiguration.resolve({
    requestUrl: c.req.url,
    forwardedHost: c.req.header("X-Forwarded-Host") ?? null,
  })

  if (accessToken === null || issuer instanceof Error) {
    throw new OIDCInvalidTokenError(issuer instanceof Error ? issuer : undefined)
  }

  const storedAccessToken = await new FindOidcAccessTokenAdapter(c).findOidcAccessToken({
    issuer,
    accessToken,
  })
  if (storedAccessToken instanceof Error) {
    throw new OIDCTemporarilyUnavailableError(
      new OidcTemporarilyUnavailableApplicationError(storedAccessToken),
    )
  }
  if (storedAccessToken === null) {
    throw new OIDCInvalidTokenError(new OidcInvalidTokenApplicationError())
  }

  const scope = OidcScopeValue.create(storedAccessToken.scope)
  if (scope instanceof Error) {
    throw new OIDCInvalidTokenError(new OidcInvalidTokenApplicationError(scope))
  }

  const identity = await new SystemOidcIdentityAdapter(c).findByAccountId(
    storedAccessToken.accountId,
  )
  if (identity instanceof Error) {
    throw new OIDCTemporarilyUnavailableError(
      new OidcTemporarilyUnavailableApplicationError(identity),
    )
  }
  if (identity === null) {
    throw new OIDCInvalidTokenError(new OidcInvalidTokenApplicationError())
  }

  return c.json(
    {
      sub: identity.subject,
      ...(scope.includes("email") && identity.email !== null
        ? { email: identity.email, email_verified: identity.emailVerified }
        : {}),
    },
    200,
    {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  )
})
