import { SystemCLILoginUnavailableError } from "@system/interface/errors"
/** /system/cli-authorizations */
import { SystemIdentityIssuerValue } from "@system/domain/values/identity/system-identity-issuer.value"
import { SystemCliIdentityRedirectUriValue } from "@system/domain/values/oauth/system-cli-identity-redirect-uri.value"
import { CreateSystemCliLoginStateAdapter } from "@system/infrastructure/adapters/auth/create-system-cli-login-state.adapter"
import { createSystemPkce } from "@system/lib/auth/create-system-pkce"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization public - CLIが外部Identity providerで本人確認を始める
export const GET = systemFactory.createHandlers(
  zValidator(
    "query",
    z.object({
      port: z.coerce.number().int().min(1).max(65_535),
      state: z.string().min(1).max(512),
    }),
  ),
  async (context) => {
    const identityLoginUrl = context.env.IDENTITY_LOGIN_URL
    const apiOrigin = context.env.API_ORIGIN
    if (
      identityLoginUrl === undefined ||
      identityLoginUrl.length === 0 ||
      apiOrigin === undefined ||
      apiOrigin.length === 0
    ) {
      throw new SystemCLILoginUnavailableError()
    }

    if (!URL.canParse(identityLoginUrl)) {
      throw new SystemCLILoginUnavailableError()
    }
    const brokerUrl = new URL(identityLoginUrl)
    const redirectUri = SystemCliIdentityRedirectUriValue.create(apiOrigin)
    if (
      !new SystemIdentityIssuerValue(brokerUrl).isSecure ||
      brokerUrl.username !== "" ||
      brokerUrl.password !== "" ||
      brokerUrl.hash !== "" ||
      redirectUri instanceof Error
    ) {
      throw new SystemCLILoginUnavailableError()
    }

    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) {
      throw new SystemCLILoginUnavailableError()
    }
    const pkce = await createSystemPkce()
    const brokerState = crypto.randomUUID()
    const query = context.req.valid("query")
    const created = await new CreateSystemCliLoginStateAdapter(context).createSystemCliLoginState({
      state: brokerState,
      port: query.port,
      cliState: query.state,
      codeVerifier: pkce.verifier,
      createdAt: now,
      expiresAt: new Date(now.getTime() + 600_000),
    })
    if (created instanceof Error) {
      throw new SystemCLILoginUnavailableError()
    }

    brokerUrl.searchParams.set("callback", redirectUri.toString())
    brokerUrl.searchParams.set("state", brokerState)
    brokerUrl.searchParams.set("code_challenge", pkce.challenge)
    brokerUrl.searchParams.set("code_challenge_method", "S256")

    return context.redirect(brokerUrl.toString(), 302)
  },
)
