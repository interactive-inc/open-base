import { describe, expect, test } from "bun:test"
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose"
import {
  discoverOidcProvider,
  exchangeOidcCode,
  verifyOidcIdToken,
} from "@/api/http/auth/oidc-provider"
import type { OidcConfiguration } from "@/api/http/auth/sign-in-method"

const issuer = "https://id.example.com"
const configuration: OidcConfiguration = {
  issuer,
  clientId: "web-client",
  clientSecret: null,
  excludedAudiences: ["api-resource"],
}
const now = new Date("2026-01-01T00:00:00Z")
const seconds = Math.floor(now.getTime() / 1_000)

async function setup() {
  const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" })
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "EdDSA" }
  const provider = {
    issuer,
    algorithms: ["EdDSA"],
    keys: createLocalJWKSet({ keys: [jwk] }),
  }
  const sign = (claims: Record<string, unknown>, overrides: { iss?: string; exp?: number } = {}) =>
    new SignJWT({ nonce: "n1", ...claims })
      .setProtectedHeader({ alg: "EdDSA", kid: "k1" })
      .setIssuer(overrides.iss ?? issuer)
      .setSubject("subject-1")
      .setIssuedAt(seconds - 10)
      .setExpirationTime(overrides.exp ?? seconds + 300)
      .sign(privateKey)
  return { provider, sign }
}

describe("verifyOidcIdToken", () => {
  test("署名、発行者、宛先、nonceが正しいID tokenを受け付ける", async () => {
    const { provider, sign } = await setup()
    const token = await sign({ aud: "web-client", auth_time: seconds - 30 })
    expect(await verifyOidcIdToken({ token, configuration, provider, nonce: "n1", now })).toEqual({
      subject: "subject-1",
      authenticatedAt: new Date((seconds - 30) * 1_000),
    })
  })

  test("auth_timeが無ければ認証時刻はnull", async () => {
    const { provider, sign } = await setup()
    const token = await sign({ aud: "web-client" })
    const claims = await verifyOidcIdToken({ token, configuration, provider, nonce: "n1", now })
    expect(claims?.authenticatedAt).toBeNull()
  })

  test.each([
    ["認証時刻が未来", { aud: "web-client", auth_time: seconds + 60 }, {}, "n1"],
    ["nonceが違う", { aud: "web-client" }, {}, "other"],
    ["宛先が違う", { aud: "other-client" }, {}, "n1"],
    ["発行者が違う", { aud: "web-client" }, { iss: "https://evil.example.com" }, "n1"],
    ["期限切れ", { aud: "web-client" }, { exp: seconds - 1 }, "n1"],
    ["API用のaudを含む", { aud: ["web-client", "api-resource"], azp: "web-client" }, {}, "n1"],
    ["複数の宛先でazpが無い", { aud: ["web-client", "other"] }, {}, "n1"],
    ["azpが別のclient", { aud: "web-client", azp: "other" }, {}, "n1"],
  ] as const)("%sなら拒否する", async (_, claims, overrides, nonce) => {
    const { provider, sign } = await setup()
    const token = await sign({ ...claims }, overrides)
    expect(await verifyOidcIdToken({ token, configuration, provider, nonce, now })).toBeNull()
  })

  test("別の鍵で署名したtokenを拒否する", async () => {
    const { provider } = await setup()
    const other = await setup()
    const token = await other.sign({ aud: "web-client" })
    expect(await verifyOidcIdToken({ token, configuration, provider, nonce: "n1", now })).toBeNull()
  })
})

describe("discoverOidcProvider", () => {
  const document = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    id_token_signing_alg_values_supported: ["EdDSA", "none"],
  }
  const respond = (body: unknown) => (async () => Response.json(body)) as unknown as typeof fetch

  test("discoveryを読み、許可した署名方式だけを残す", async () => {
    const provider = await discoverOidcProvider(configuration, respond(document))
    if (provider instanceof Error) throw provider
    expect(provider.authorizationEndpoint).toBe(`${issuer}/authorize`)
    expect(provider.algorithms).toEqual(["EdDSA"])
    // 宣言が無ければ、再認証でもprompt=loginを送らない。
    expect(provider.supportsLoginPrompt).toBe(false)
  })

  test("prompt=loginへの対応はdiscoveryの宣言で判断する", async () => {
    const provider = await discoverOidcProvider(
      configuration,
      respond({ ...document, prompt_values_supported: ["none", "login"] }),
    )
    if (provider instanceof Error) throw provider
    expect(provider.supportsLoginPrompt).toBe(true)
  })

  test("issuerが違うdiscoveryを拒否する", async () => {
    const result = await discoverOidcProvider(
      configuration,
      respond({ ...document, issuer: "https://evil.example.com" }),
    )
    expect(result).toBeInstanceOf(Error)
  })

  test("HTTPSでないendpointを拒否する", async () => {
    const result = await discoverOidcProvider(
      configuration,
      respond({ ...document, token_endpoint: "http://id.example.com/token" }),
    )
    expect(result).toBeInstanceOf(Error)
  })
})

describe("exchangeOidcCode", () => {
  const provider = {
    issuer,
    authorizationEndpoint: `${issuer}/authorize`,
    tokenEndpoint: `${issuer}/token`,
    algorithms: ["EdDSA"],
    keys: createLocalJWKSet({ keys: [] }),
    supportsLoginPrompt: false,
  }

  test("public clientはPKCEのverifierとclient IDだけを送る", async () => {
    let sent: RequestInit | undefined
    const fetcher = (async (_url: string, init: RequestInit) => {
      sent = init
      return Response.json({ id_token: "token" })
    }) as unknown as typeof fetch
    const result = await exchangeOidcCode(
      { configuration, provider, code: "c", codeVerifier: "v", redirectUri: "https://app/cb" },
      fetcher,
    )
    expect(result).toBe("token")
    const body = new URLSearchParams(String(sent?.body))
    expect(body.get("code_verifier")).toBe("v")
    expect(body.get("client_id")).toBe("web-client")
    expect((sent?.headers as Record<string, string>).authorization).toBeUndefined()
  })

  test("client secretがあればBasic認証で送る", async () => {
    let headers: Record<string, string> = {}
    const fetcher = (async (_url: string, init: RequestInit) => {
      headers = init.headers as Record<string, string>
      return Response.json({ id_token: "token" })
    }) as unknown as typeof fetch
    await exchangeOidcCode(
      {
        configuration: { ...configuration, clientSecret: "s" },
        provider,
        code: "c",
        codeVerifier: "v",
        redirectUri: "https://app/cb",
      },
      fetcher,
    )
    expect(headers.authorization).toBe(`Basic ${btoa("web-client:s")}`)
  })

  test("失敗の応答はErrorにする", async () => {
    const fetcher = (async () => new Response("no", { status: 400 })) as unknown as typeof fetch
    const result = await exchangeOidcCode(
      { configuration, provider, code: "c", codeVerifier: "v", redirectUri: "https://app/cb" },
      fetcher,
    )
    expect(result).toBeInstanceOf(Error)
  })
})
