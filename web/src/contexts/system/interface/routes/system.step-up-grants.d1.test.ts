import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemHTTPException } from "@system/interface/errors"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.step-up-grants"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/test/create-system-identity-token.test-support"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const nowEpoch = Math.floor(now.getTime() / 1_000)
const identityKey = await createSystemIdentityTestKey("step-up-key")
const identityIssuer = "https://identity-provider.example/"
const identityAudience = "urn:system:identity-login"
const accountId = zAccountId.parse("6c047840-0ba9-4c7a-8491-8dda0db0dc15")
const subject = "external-step-up-subject"
const jwtSecret = "external-step-up-jwt-secret"

describe("POST /system/step-up-grants", () => {
  test("直前に認証した外部Identity tokenを現在のAccountへ束縛し、replay・古い認証・認証時刻なしを拒否する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedIdentity(fixture)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    const app = createApp(fixture, accessToken)
    const client = app.client
    const token = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "external-step-up-fresh",
      keyId: identityKey.keyId,
      audience: identityAudience,
    })

    const issued = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token },
    })
    expect({ status: issued.status, body: await issued.json() }).toMatchObject({
      status: 201,
      body: {
        method: "external_identity",
        expires_at: "2026-01-01T00:05:00.000Z",
      },
    })
    const replay = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token },
    })
    expect(Number(replay.status)).toBe(401)

    const staleToken = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "external-step-up-stale",
      keyId: identityKey.keyId,
      // 発行は新しくても、認証が古ければ token の更新にすぎないので再認証として扱わない。
      authTime: nowEpoch - 301,
      audience: identityAudience,
    })
    const stale = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token: staleToken },
    })
    expect(Number(stale.status)).toBe(401)

    const unauthenticatedToken = await createSystemIdentityToken(identityKey.signingKey, nowEpoch, {
      sub: subject,
      jti: "external-step-up-without-auth-time",
      keyId: identityKey.keyId,
      authTime: null,
      audience: identityAudience,
    })
    const unauthenticated = await client.system["step-up-grants"].$post({
      json: { method: "external_identity", token: unauthenticatedToken },
    })
    expect(Number(unauthenticated.status)).toBe(401)
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM system_audit_events
           WHERE action = 'auth.step_up.issued'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
  })
})

function createApp(fixture: SystemSessionTestContext, accessToken: string) {
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/step-up-grants", ...POST)
  app.onError((error, context) => {
    if (!(error instanceof SystemHTTPException)) throw error
    return context.json({ code: error.code, detail: error.detail }, error.status)
  })
  const request = (
    input: Parameters<typeof app.request>[0],
    init?: Parameters<typeof app.request>[1],
  ) =>
    app.request(input, init, {
      DB: fixture.context.env.DB,
      JWT_SECRET: jwtSecret,
      IDENTITY_JWKS: identityKey.jwks,
      IDENTITY_ISSUER: identityIssuer,
      IDENTITY_AUDIENCE: identityAudience,
    })
  return {
    client: hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  }
}

async function seedIdentity(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('f40b56a8-d467-4da0-83dd-155622b36082', ?1, 'oidc', ?2, ?3, ?3, NULL)`)
    .bind(accountId, subject, now.getTime())
    .run()
}

async function issueAccessToken(fixture: SystemSessionTestContext): Promise<string | Error> {
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) return applications
  const issued = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: new Date(),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (issued instanceof Error || issued.kind === "rejected") {
    return issued instanceof Error ? issued : new Error(issued.reason)
  }
  return issued.accessToken
}
