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
import { hashPassword } from "@system/lib/auth/hash-password"

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
const pepper = "example-step-up-pepper"
const passwordIdentityId = "8a936e57-46c8-4944-b06e-d28c1614b322"

test("password再認証は10回の失敗で制限し、窓の経過で回復する", async () => {
  const fixture = await SystemSessionTestContext.create()
  await seedIdentity(fixture)
  await seedPassword(fixture)
  const accessToken = await issueAccessToken(fixture)
  if (accessToken instanceof Error) throw accessToken
  const client = createApp(fixture, accessToken).client
  const statuses: number[] = []
  for (const attempt of Array.from({ length: 15 }, (_, index) => index)) {
    statuses.push(
      (
        await client.system["step-up-grants"].$post({
          json: { password: `example-wrong-${attempt}` },
        })
      ).status,
    )
  }
  expect(statuses).toEqual([...Array(10).fill(401), ...Array(5).fill(429)])
  const blocked = await client.system["step-up-grants"].$post({
    json: { password: "example-correct" },
  })
  expect(Number(blocked.status)).toBe(429)
  expect(
    await fixture.database
      .prepare(
        "SELECT count(*) AS total FROM system_audit_events WHERE action = 'auth.step_up.issued' AND outcome = 'denied' AND reason_code = 'invalid_credentials'",
      )
      .first<{ total: number }>(),
  ).toEqual({ total: 10 })
  const later = createApp(fixture, accessToken, new Date(now.getTime() + 15 * 60_000 + 1)).client
  expect(
    (await later.system["step-up-grants"].$post({ json: { password: "example-correct" } })).status,
  ).toBe(201)
})

test("password再認証の成功は本人の試行をresetし、通常ログインの記録を保全する", async () => {
  const fixture = await SystemSessionTestContext.create()
  await seedIdentity(fixture)
  await seedPassword(fixture)
  const accessToken = await issueAccessToken(fixture)
  if (accessToken instanceof Error) throw accessToken
  await fixture.database
    .prepare(
      "INSERT INTO system_authentication_attempts (id, identifier, ip, attempted_at) VALUES (?1, 'you@example.com', 'anonymous', ?2)",
    )
    .bind(crypto.randomUUID(), now.getTime())
    .run()
  const client = createApp(fixture, accessToken).client
  for (const attempt of [1, 2]) {
    const denied = await client.system["step-up-grants"].$post({
      json: { password: `example-wrong-${attempt}` },
    })
    expect(Number(denied.status)).toBe(401)
  }
  expect(
    (await client.system["step-up-grants"].$post({ json: { password: "example-correct" } })).status,
  ).toBe(201)
  const remaining = await fixture.database
    .prepare("SELECT identifier FROM system_authentication_attempts")
    .all()
  expect(remaining.results).toEqual([{ identifier: "you@example.com" }])
})

test("password再認証は試行を記録できなければgrantを発行しない", async () => {
  const fixture = await SystemSessionTestContext.create()
  await seedIdentity(fixture)
  await seedPassword(fixture)
  const accessToken = await issueAccessToken(fixture)
  if (accessToken instanceof Error) throw accessToken
  await fixture.database.prepare("DROP TABLE system_authentication_attempts").run()
  const response = await createApp(fixture, accessToken).client.system["step-up-grants"].$post({
    json: { password: "example-correct" },
  })
  expect(Number(response.status)).toBe(503)
})

test("password再認証の失敗を監査できなければ安全な利用不能を返す", async () => {
  const fixture = await SystemSessionTestContext.create()
  await seedIdentity(fixture)
  await seedPassword(fixture)
  const accessToken = await issueAccessToken(fixture)
  if (accessToken instanceof Error) throw accessToken
  await fixture.database
    .prepare(
      "CREATE TRIGGER block_step_up_denial BEFORE INSERT ON system_audit_events WHEN NEW.action = 'auth.step_up.issued' AND NEW.outcome = 'denied' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END",
    )
    .run()
  const response = await createApp(fixture, accessToken).client.system["step-up-grants"].$post({
    json: { password: "example-wrong" },
  })
  expect(Number(response.status)).toBe(503)
})

async function seedPassword(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(
      "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at, revoked_at) VALUES (?1, ?2, 'password', 'you@example.com', ?3, ?3, NULL)",
    )
    .bind(passwordIdentityId, accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(
      "INSERT INTO system_password_credentials (identity_id, password_hash, changed_at, created_at, updated_at) VALUES (?1, ?2, ?3, ?3, ?3)",
    )
    .bind(passwordIdentityId, await hashPassword("example-correct", pepper), now.getTime())
    .run()
}

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

function createApp(fixture: SystemSessionTestContext, accessToken: string, at: Date = now) {
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => at)
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
      PEPPER_SECRET: pepper,
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
