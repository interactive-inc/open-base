import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose"
import { z } from "zod"
import { isSecureOidcUrl, type OidcConfiguration } from "./sign-in-method.ts"

const ALLOWED_ALGORITHMS = ["EdDSA", "ES256", "ES384", "RS256", "PS256"] as const

const discoverySchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string().url(),
  token_endpoint: z.string().url(),
  jwks_uri: z.string().url(),
  id_token_signing_alg_values_supported: z.array(z.string()).optional(),
  prompt_values_supported: z.array(z.string()).optional(),
})

export type OidcProviderMetadata = Readonly<{
  issuer: string
  authorizationEndpoint: string
  tokenEndpoint: string
  algorithms: ReadonlyArray<string>
  keys: JWTVerifyGetKey
  /** 発行者が `prompt=login`（認証し直しの強制）を受け付けると宣言しているか。 */
  supportsLoginPrompt: boolean
}>

export type OidcIdTokenClaims = Readonly<{
  subject: string
  /** 利用者がIdPで認証した時刻。無ければ null。 */
  authenticatedAt: Date | null
}>

/**
 * 発行者のdiscoveryを読む。issuerの一致と、endpointがHTTPSであることを確かめる。
 */
export async function discoverOidcProvider(
  configuration: OidcConfiguration,
  fetcher: typeof fetch = fetch,
): Promise<OidcProviderMetadata | Error> {
  try {
    const url = `${configuration.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return new Error("OIDC discovery failed")
    const parsed = discoverySchema.safeParse(await response.json())
    if (!parsed.success) return new Error("OIDC discovery is invalid")
    const metadata = parsed.data
    if (metadata.issuer !== configuration.issuer) return new Error("OIDC issuer does not match")
    const endpoints = [metadata.authorization_endpoint, metadata.token_endpoint, metadata.jwks_uri]
    if (endpoints.some((endpoint) => !isSecureOidcUrl(new URL(endpoint)))) {
      return new Error("OIDC endpoints must use HTTPS")
    }
    const supported = metadata.id_token_signing_alg_values_supported ?? ["RS256"]
    const algorithms = ALLOWED_ALGORITHMS.filter((algorithm) => supported.includes(algorithm))
    if (algorithms.length === 0) return new Error("OIDC signing algorithm is not supported")
    return Object.freeze({
      issuer: metadata.issuer,
      authorizationEndpoint: metadata.authorization_endpoint,
      tokenEndpoint: metadata.token_endpoint,
      algorithms,
      keys: createRemoteJWKSet(new URL(metadata.jwks_uri)),
      supportsLoginPrompt: metadata.prompt_values_supported?.includes("login") === true,
    })
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("OIDC discovery failed")
  }
}

/** 認可codeをPKCEのverifierと一緒にID tokenへ交換する。 */
export async function exchangeOidcCode(
  input: Readonly<{
    configuration: OidcConfiguration
    provider: OidcProviderMetadata
    code: string
    codeVerifier: string
    redirectUri: string
  }>,
  fetcher: typeof fetch = fetch,
): Promise<string | Error> {
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: input.configuration.clientId,
    })
    const headers: Record<string, string> = {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    }
    const secret = input.configuration.clientSecret
    if (secret !== null) {
      const encode = (value: string) => encodeURIComponent(value)
      headers.authorization = `Basic ${btoa(`${encode(input.configuration.clientId)}:${encode(secret)}`)}`
    }
    const response = await fetcher(input.provider.tokenEndpoint, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return new Error("OIDC code exchange failed")
    const parsed = z
      .object({ id_token: z.string().min(1).max(16_384) })
      .safeParse(await response.json())
    return parsed.success ? parsed.data.id_token : new Error("OIDC token response is invalid")
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("OIDC code exchange failed")
  }
}

const claimsSchema = z.object({
  sub: z.string().min(1).max(255),
  nonce: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  azp: z.string().optional(),
  auth_time: z.number().int().nonnegative().optional(),
  iat: z.number().int().nonnegative(),
})

/**
 * ID tokenの署名、発行者、宛先、期限、nonceを検証する。
 * 宛先が複数あるときは、azpがこのclientであることも求める。
 */
export async function verifyOidcIdToken(
  input: Readonly<{
    token: string
    configuration: OidcConfiguration
    provider: Pick<OidcProviderMetadata, "issuer" | "algorithms" | "keys">
    nonce: string
    now: Date
  }>,
): Promise<OidcIdTokenClaims | null> {
  try {
    const verified = await jwtVerify(input.token, input.provider.keys, {
      algorithms: [...input.provider.algorithms],
      issuer: input.provider.issuer,
      audience: input.configuration.clientId,
      currentDate: input.now,
      requiredClaims: ["exp", "iat", "sub", "nonce"],
    })
    const claims = claimsSchema.safeParse(verified.payload)
    if (!claims.success || claims.data.nonce !== input.nonce) return null
    const audiences = typeof claims.data.aud === "string" ? [claims.data.aud] : claims.data.aud
    if (audiences.some((audience) => input.configuration.excludedAudiences.includes(audience))) {
      return null
    }
    if (audiences.length > 1 && claims.data.azp !== input.configuration.clientId) return null
    if (claims.data.azp !== undefined && claims.data.azp !== input.configuration.clientId) {
      return null
    }
    const authTime = claims.data.auth_time
    const nowSeconds = Math.floor(input.now.getTime() / 1_000)
    if (
      claims.data.iat > nowSeconds ||
      (authTime !== undefined && (authTime > nowSeconds || authTime > claims.data.iat))
    )
      return null
    return Object.freeze({
      subject: claims.data.sub,
      authenticatedAt: authTime === undefined ? null : new Date(authTime * 1_000),
    })
  } catch {
    return null
  }
}
