import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { toPkceS256Challenge } from "@system/lib/auth/to-pkce-s256-challenge"
import { createOidcSecret } from "@system/application/auth/identity/lib/create-oidc-secret"
import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.oauth.token"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import { drizzle } from "drizzle-orm/d1"
import { hc } from "hono/client"
import { exportJWK, generateKeyPair } from "jose"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const issuer = "https://identity.example.test"
const clientId = "system-console"
const redirectUri = "https://console.example.test/callback"
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

function createOidcClientRegistry(): OidcClientRegistryValue {
  const registry = OidcClientRegistryValue.restore({
    [issuer]: [{ id: clientId, name: "System Console", redirectUris: [redirectUri] }],
  })
  if (registry instanceof Error) throw registry
  return registry
}

async function createSigningKeys(): Promise<string> {
  const generated = await generateKeyPair("ES256", { extractable: true })
  const key = await exportJWK(generated.privateKey)

  if (key.x === undefined || key.y === undefined || key.d === undefined) {
    throw new Error("test OIDC key is incomplete")
  }

  return JSON.stringify({
    active: {
      kty: "EC",
      crv: "P-256",
      x: key.x,
      y: key.y,
      d: key.d,
      kid: "test-key",
      use: "sig",
      alg: "ES256",
    },
    previous: [],
  })
}

describe("POST /oauth/token", () => {
  test("canonical AccountEntity・Identity・OIDC storageからtokenを発行してSystem監査を残す", async () => {
    const fixture = await SystemSessionTestContext.create()
    const code = createOidcSecret()
    const codeHash = await hashOidcSecret(code)
    const codeChallenge = await toPkceS256Challenge(verifier)
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', 'active', 0, ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'password', 'person@example.com', ?1, ?1, NULL)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_identity_profiles
           (identity_id, email, email_verified, last_used_at, updated_at)
         VALUES ('637b1ce9-daa9-4063-8cb0-1190607a2ceb', 'person@example.com', 1, ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_oidc_authorization_codes
           (code_hash, issuer, client_id, redirect_uri, account_id, code_challenge,
            nonce, scope, expires_at, created_at)
         VALUES (?1, ?2, ?3, ?4, 'd5858208-e680-4db8-a05d-8bf4f900c24e', ?5, 'nonce-with-enough-entropy',
                 'openid profile email', ?6, ?7)`)
      .bind(
        codeHash,
        issuer,
        clientId,
        redirectUri,
        codeChallenge,
        now.getTime() + 120_000,
        now.getTime(),
      )
      .run()

    const database = drizzle(fixture.context.env.DB, { schema: systemCoreSchema })
    const signingKeys = await createSigningKeys()
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("database", database)
        context.set("now", () => now)
        context.set("oidcClientRegistry", createOidcClientRegistry())
        context.set(
          "oidcIssuerConfiguration",
          new OidcIssuerConfigurationValue({
            issuersByHostname: { "identity.example.test": issuer },
            localProxyHostnames: [],
            localIssuerHostname: null,
          }),
        )
        await next()
      })
      .post("/system/oauth/token", ...POST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        OIDC_SIGNING_KEYS: signingKeys,
      })
    const client = hc<typeof app>(issuer, { fetch: request })
    const response = await client.system.oauth.token.$post({
      form: {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
    expect(await response.json()).toMatchObject({
      token_type: "Bearer",
      expires_in: 300,
      scope: "openid profile email",
    })
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS total FROM system_oidc_access_tokens")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
    expect(
      await fixture.database
        .prepare("SELECT action, outcome FROM system_audit_events")
        .first<Record<string, unknown>>(),
    ).toEqual({
      action: "auth.oidc.token_exchange",
      outcome: "succeeded",
    })
  })
})
