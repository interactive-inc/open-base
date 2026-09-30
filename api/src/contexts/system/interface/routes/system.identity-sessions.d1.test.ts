import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { SystemHTTPException } from "@system/interface/errors"
import { POST } from "@system/interface/routes/system.identity-sessions"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/test/create-system-identity-token.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const jwtSecret = "identity-session-route-jwt-secret"
const identityKey = await createSystemIdentityTestKey()
const wrongIdentityKey = await createSystemIdentityTestKey("wrong-key")
const identityIssuer = "https://identity-provider.example/"
const identityAudience = "urn:system:identity-login"
const now = new Date("2026-01-01T00:00:00.000Z")
const nowEpoch = Math.floor(now.getTime() / 1_000)
const accountId = "d5b441be-4549-465f-ab69-7d4b147b7cb0"
const subject = "external-subject-1"

async function createFixture(
  configuration: Readonly<{
    jwks?: string
    issuer?: string
    audience?: string
  }> = Object.freeze({
    jwks: identityKey.jwks,
    issuer: identityIssuer,
    audience: identityAudience,
  }),
) {
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(`INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('0a83182e-c8a7-40d5-be3b-adeffed2ef84', ?1, 'oidc', ?2, ?3, ?3, NULL)`)
    .bind(accountId, subject, now.getTime())
    .run()

  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/identity-sessions", ...POST)
  app.onError((error, context) => {
    if (!(error instanceof SystemHTTPException)) throw error
    return context.json({ error: error.detail, code: error.code, ...error.metadata }, error.status)
  })
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        IDENTITY_JWKS: configuration.jwks,
        IDENTITY_ISSUER: configuration.issuer,
        IDENTITY_AUDIENCE: configuration.audience,
      }),
  })

  return Object.freeze({ client, fixture })
}

describe("POST /system/identity-sessions", () => {
  test("issues a canonical System Session without any Company records", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-success",
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(response.status).toBe(201)
    const body = await response.json()
    if (!("account_id" in body)) throw new Error("expected issued System Session")
    expect(body.account_id).toBe(accountId)
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length).toBe(64)
    expect(body.session_id.length > 0).toBe(true)
    expect(body.expires_at).toBe("2026-01-08T00:00:00.000Z")
    expect(
      (
        await fixture.database
          .prepare("SELECT action, reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ action: "auth.session.create", reason_code: null }])
    expect(
      (
        await fixture.database
          .prepare("SELECT jti FROM system_identity_login_tokens ORDER BY jti")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ jti: "identity-session-success" }])
  })

  test("rejects a token with an invalid signature and records the denial in System audit", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(wrongIdentityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-invalid-signature",
      keyId: wrongIdentityKey.keyId,
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect((await response.json()) as unknown).toEqual({
      error: "identity login denied",
      code: "identity_login_denied",
    })
    expect(
      (
        await fixture.database
          .prepare("SELECT action, reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ action: "auth.session.identity_login_denied", reason_code: "invalid_token" }])
  })

  test("rejects a token whose issuer does not match", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-invalid-issuer",
      issuer: "https://attacker.example/",
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ reason_code: "invalid_token" }])
  })

  test("rejects a token whose audience does not match", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-invalid-audience",
      audience: "urn:another-system",
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ reason_code: "invalid_token" }])
  })

  test("rejects an expired token", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch - 120, {
      sub: subject,
      jti: "identity-session-expired",
      iat: nowEpoch - 120,
      exp: nowEpoch - 60,
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ reason_code: "invalid_token" }])
  })

  test("rejects an unverified email", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-unverified-email",
      emailVerified: false,
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ reason_code: "email_unverified" }])
  })

  test("does not disclose whether an Identity or AccountEntity exists", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: "unknown-subject",
      jti: "identity-session-unknown-account",
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect((await response.json()) as unknown).toEqual({
      error: "identity login denied",
      code: "identity_login_denied",
    })
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ reason_code: "account_not_found" }])
  })

  test("rejects a suspended System AccountEntity without consulting Company", async () => {
    const { client, fixture } = await createFixture()
    await fixture.database
      .prepare(`UPDATE system_accounts
         SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
         WHERE id = ?1`)
      .bind(accountId)
      .run()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-suspended-account",
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ reason_code: "account_inactive" }])
  })

  test("rejects replay of the same external token", async () => {
    const { client, fixture } = await createFixture()
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-replay",
      audience: identityAudience,
    })

    const first = await client.system["identity-sessions"].$post({ json: { token } })
    const second = await client.system["identity-sessions"].$post({ json: { token } })

    expect(first.status).toBe(201)
    expect(Number(second.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT action, reason_code FROM system_audit_events ORDER BY rowid")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([
      { action: "auth.session.create", reason_code: null },
      { action: "auth.session.identity_login_denied", reason_code: "token_replayed" },
    ])
  })

  test("returns unavailable when external Identity configuration is missing", async () => {
    const { client, fixture } = await createFixture(Object.freeze({}))
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "identity-session-not-configured",
      audience: identityAudience,
    })

    const response = await client.system["identity-sessions"].$post({ json: { token } })

    expect(Number(response.status)).toBe(503)
    expect((await response.json()) as unknown).toEqual({
      error: "identity login is unavailable",
      code: "identity_login_unavailable",
    })
    expect(
      (
        await fixture.database
          .prepare("SELECT action FROM system_audit_events")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
  })
})
