import {
  SystemSignedInSessionChannel,
  type SystemSignedInSession,
} from "@system/interface/request-environment/system-signed-in-session-channel"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemHTTPException } from "@system/interface/errors"
import { hashPassword } from "@system/lib/auth/hash-password"
import * as verifySystemPasswordModule from "@system/lib/auth/verify-system-password"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.step-up-grants"
import { createSystemIdentityTestKey } from "@system/test/create-system-identity-test-key.test-support"
import { createSystemIdentityToken } from "@system/test/create-system-identity-token.test-support"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { afterAll, afterEach, describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
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
const password = "correct-step-up-password"
const wrongPassword = "wrong-step-up-password"
const pepper = "step-up-test-pepper"
const passwordSubject = "step-up-owner@example.test"
const attemptWindowMilliseconds = 15 * 60 * 1_000
const maxAttempts = 10
const passwordHash = await hashPassword(password, pepper)
const secondPassword = "second-step-up-password"
const pendingPassword = "pending-step-up-password"
const revokedPassword = "revoked-step-up-password"
const otherAccountPassword = "other-account-step-up-password"
const otherAccountId = zAccountId.parse("8b1a7f4d-9e6c-4d2b-a0f1-4c3b5a6f7e8d")
const secondPasswordHash = await hashPassword(secondPassword, pepper)
const pendingPasswordHash = await hashPassword(pendingPassword, pepper)
const revokedPasswordHash = await hashPassword(revokedPassword, pepper)
const otherAccountPasswordHash = await hashPassword(otherAccountPassword, pepper)

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

describe("POST /system/step-up-grants (password の試行制限)", () => {
  afterEach(() => {
    verifySystemPasswordSpy.mockClear()
  })

  test("上限まで誤ったパスワードを送ると、正しいパスワードでも検証せず 429 にし、窓の経過で回復する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedPasswordIdentity(fixture)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    const client = createApp(fixture, accessToken).client

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const wrong = await client.system["step-up-grants"].$post({
        json: { method: "password", password: wrongPassword },
      })
      expect(Number(wrong.status)).toBe(401)
    }
    expect(verifySystemPasswordSpy).toHaveBeenCalledTimes(maxAttempts)

    const limited = await client.system["step-up-grants"].$post({
      json: { method: "password", password },
    })
    expect({ status: Number(limited.status), body: await limited.json() }).toMatchObject({
      status: 429,
      body: { code: "authentication_rate_limited" },
    })
    expect(verifySystemPasswordSpy).toHaveBeenCalledTimes(maxAttempts)
    expect(await countIssuedGrants(fixture)).toEqual({ grants: 0, audits: 0 })

    const recovered = await createApp(
      fixture,
      accessToken,
      new Date(now.getTime() + attemptWindowMilliseconds),
    ).client.system["step-up-grants"].$post({ json: { method: "password", password } })
    expect(recovered.status).toBe(201)
    expect(await countIssuedGrants(fixture)).toEqual({ grants: 1, audits: 1 })
    expect(await countReauthenticationAttempts(fixture)).toBe(0)
  })

  test("ログインの失敗は数えず、並行した誤りでも上限を超えて検証しない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedPasswordIdentity(fixture)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    // 第三者が同じ Account のログインを上限まで失敗させても、本人の再認証は締め出されない。
    for (let attempt = 0; attempt < 21; attempt += 1) {
      await fixture.database
        .prepare(`INSERT INTO system_authentication_attempts (id, identifier, ip, attempted_at)
           VALUES (?1, ?2, '198.51.100.7', ?3)`)
        .bind(crypto.randomUUID(), passwordSubject, now.getTime())
        .run()
    }
    const client = createApp(fixture, accessToken).client

    const issued = await client.system["step-up-grants"].$post({
      json: { method: "password", password },
    })
    expect(issued.status).toBe(201)
    verifySystemPasswordSpy.mockClear()

    const statuses = await Promise.all(
      Array.from({ length: 15 }, async () => {
        const response = await client.system["step-up-grants"].$post({
          json: { method: "password", password: wrongPassword },
        })
        return Number(response.status)
      }),
    )
    expect(statuses.filter((status) => status === 401)).toHaveLength(maxAttempts)
    expect(statuses.filter((status) => status === 429)).toHaveLength(5)
    expect(verifySystemPasswordSpy).toHaveBeenCalledTimes(maxAttempts)
    expect(await countReauthenticationAttempts(fixture)).toBe(maxAttempts)
  })
})

describe("POST /system/step-up-grants (複数のpassword login ID)", () => {
  afterEach(() => {
    verifySystemPasswordSpy.mockClear()
  })

  test("有効なlogin IDのどちらのpasswordでも再認証でき、pending・失効・別Account・誤りは拒否し、試行は1回だけ数える", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedPasswordIdentity(fixture)
    await seedAdditionalPasswordIdentity(fixture, {
      id: "2e8d4c1a-6b3f-4a9e-8c7d-1f0e2d3c4b5a",
      subject: "step-up-second@example.test",
      passwordHash: secondPasswordHash,
      activatedAt: now.getTime(),
      revokedAt: null,
    })
    await seedAdditionalPasswordIdentity(fixture, {
      id: "3f9e5d2b-7c4a-4b0f-9d8e-2a1f3e4d5c6b",
      subject: "step-up-pending@example.test",
      passwordHash: pendingPasswordHash,
      activatedAt: null,
      revokedAt: null,
    })
    await seedAdditionalPasswordIdentity(fixture, {
      id: "4a0f6e3c-8d5b-4c1a-8e9f-3b2a4f5e6d7c",
      subject: "step-up-revoked@example.test",
      passwordHash: revokedPasswordHash,
      activatedAt: now.getTime() - 2_000,
      revokedAt: now.getTime() - 1_000,
    })
    await seedOtherAccountPasswordIdentity(fixture)
    const accessToken = await issueAccessToken(fixture)
    if (accessToken instanceof Error) throw accessToken
    const client = createApp(fixture, accessToken).client

    const wrong = await client.system["step-up-grants"].$post({
      json: { method: "password", password: wrongPassword },
    })
    expect(Number(wrong.status)).toBe(401)
    // 候補が2件でも試行は1回として数え、有効な2件だけを照合する。
    expect(await countReauthenticationAttempts(fixture)).toBe(1)
    expect(verifySystemPasswordSpy).toHaveBeenCalledTimes(2)

    for (const rejected of [pendingPassword, revokedPassword, otherAccountPassword]) {
      const response = await client.system["step-up-grants"].$post({
        json: { method: "password", password: rejected },
      })
      expect(Number(response.status)).toBe(401)
    }
    expect(await countIssuedGrants(fixture)).toEqual({ grants: 0, audits: 0 })

    for (const accepted of [password, secondPassword]) {
      const response = await client.system["step-up-grants"].$post({
        json: { method: "password", password: accepted },
      })
      expect(response.status).toBe(201)
    }
    expect(await countIssuedGrants(fixture)).toEqual({ grants: 2, audits: 2 })
    expect(await countReauthenticationAttempts(fixture)).toBe(0)
  })
})

const verifySystemPasswordSpy = spyOn(verifySystemPasswordModule, "verifySystemPassword")

afterAll(() => {
  verifySystemPasswordSpy.mockRestore()
})

async function seedPasswordIdentity(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('0b7c6a0e-3f0e-4b8e-9d3a-5c1f2e7a9b10', ?1, 'password', ?2, ?3, ?3, NULL)`)
    .bind(accountId, passwordSubject, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_password_credentials
         (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES ('0b7c6a0e-3f0e-4b8e-9d3a-5c1f2e7a9b10', ?1, ?2, ?2, ?2)`)
    .bind(passwordHash, now.getTime())
    .run()
}

async function seedAdditionalPasswordIdentity(
  fixture: SystemSessionTestContext,
  seed: Readonly<{
    id: string
    subject: string
    passwordHash: string
    activatedAt: number | null
    revokedAt: number | null
  }>,
): Promise<void> {
  const createdAt = now.getTime() - 3_000
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES (?1, ?2, 'password', ?3, ?4, ?5, ?6)`)
    .bind(seed.id, accountId, seed.subject, createdAt, seed.activatedAt, seed.revokedAt)
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_password_credentials
         (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?3, ?3)`)
    .bind(seed.id, seed.passwordHash, createdAt)
    .run()
}

async function seedOtherAccountPasswordIdentity(fixture: SystemSessionTestContext): Promise<void> {
  const identityId = "5b1a7f4d-9e6c-4d2b-a0f1-4c3b5a6f7e8d"
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(otherAccountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES (?1, ?2, 'password', 'step-up-other@example.test', ?3, ?3, NULL)`)
    .bind(identityId, otherAccountId, now.getTime())
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_password_credentials
         (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?3, ?3)`)
    .bind(identityId, otherAccountPasswordHash, now.getTime())
    .run()
}

async function countIssuedGrants(fixture: SystemSessionTestContext) {
  const grants = await fixture.database
    .prepare("SELECT count(*) AS total FROM system_step_up_grants WHERE account_id = ?1")
    .bind(accountId)
    .first<{ total: number }>()
  const audits = await fixture.database
    .prepare(
      "SELECT count(*) AS total FROM system_audit_events WHERE action = 'auth.step_up.issued'",
    )
    .first<{ total: number }>()
  return { grants: grants?.total, audits: audits?.total }
}

async function countReauthenticationAttempts(fixture: SystemSessionTestContext) {
  const attempts = await fixture.database
    .prepare("SELECT count(*) AS total FROM system_authentication_attempts WHERE identifier = ?1")
    .bind(`password-reauthentication|${accountId}`)
    .first<{ total: number }>()
  return attempts?.total
}

function createApp(
  fixture: SystemSessionTestContext,
  accessToken: string,
  requestedAt: Date = now,
  signedIn?: SystemSignedInSession,
) {
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => requestedAt)
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
    app.request(
      input,
      init,
      attachSession(
        {
          DB: fixture.context.env.DB,
          JWT_SECRET: jwtSecret,
          PEPPER_SECRET: pepper,
          IDENTITY_JWKS: identityKey.jwks,
          IDENTITY_ISSUER: identityIssuer,
          IDENTITY_AUDIENCE: identityAudience,
        },
        signedIn,
      ),
    )
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

function attachSession<T extends object>(env: T, session: SystemSignedInSession | undefined): T {
  return session === undefined ? env : new SystemSignedInSessionChannel({ env }).attach(session)
}

describe("検証済みセッションによる再認証", () => {
  const session: SystemSignedInSession = {
    accountId,
    sessionId: "test-session",
    method: "passkey",
    accountTokenVersion: 0,
    createdAt: now,
    authenticatedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
  }
  test.each(["password", "passkey", "oidc"] as const)(
    "新しい%sセッションを受け付ける",
    async (method) => {
      const fixture = await SystemSessionTestContext.create()
      await seedIdentity(fixture)
      const response = await createApp(fixture, "", now, { ...session, method }).client.system[
        "step-up-grants"
      ].$post({ json: { method: "session" } })
      expect(response.status).toBe(201)
      expect(await response.json()).toMatchObject({
        method: method === "oidc" ? "external_identity" : method,
      })
    },
  )
  test.each([
    { method: "device" as const },
    { authenticatedAt: null },
    { authenticatedAt: new Date(now.getTime() - 300_001) },
    { authenticatedAt: new Date(now.getTime() + 1) },
    { accountTokenVersion: 1 },
    { expiresAt: now },
  ])("古い・失効した・本人確認でないセッションを拒否する: %j", async (change) => {
    const fixture = await SystemSessionTestContext.create()
    await seedIdentity(fixture)
    const response = await createApp(fixture, "", now, { ...session, ...change }).client.system[
      "step-up-grants"
    ].$post({ json: { method: "session" } })
    expect(Number(response.status)).toBe(401)
    expect(await countIssuedGrants(fixture)).toEqual({ grants: 0, audits: 0 })
  })
})
