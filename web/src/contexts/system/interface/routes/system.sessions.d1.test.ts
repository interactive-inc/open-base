import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { drizzle } from "drizzle-orm/d1"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { BeginSystemTotpEnrollment } from "@system/application/auth/begin-system-totp-enrollment"
import { EnableSystemTotp } from "@system/application/auth/enable-system-totp"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { generateSystemTotpCode } from "@system/lib/auth/generate-system-totp-code"
import { systemTotpStepAt } from "@system/lib/auth/system-totp-step-at"
import { hashPassword } from "@system/lib/auth/hash-password"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { SystemHTTPException } from "@system/interface/errors"
import * as systemSessionsRoute from "@system/interface/routes/system.sessions"
import {
  DELETE,
  PATCH,
  POST,
  type SystemSessionHttpEnvironment,
} from "@system/interface/routes/system.sessions"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const issuedAt = new Date("2026-01-01T00:00:00.000Z")
const rotatedAt = new Date("2026-01-02T00:00:00.000Z")
const revokedAt = new Date("2026-01-03T00:00:00.000Z")
const accountId = "8fb81ded-072d-4ae1-968c-ace4dbec9950"
const subject = "person@example.com"
const password = "correct-password"
const pepper = "system-session-test-pepper"
const jwtSecret = "system-session-route-test-secret"

function createApp() {
  const app = new Hono<SystemSessionHttpEnvironment>()
    .post("/system/sessions", ...POST)
    .patch("/system/sessions", ...PATCH)
    .delete("/system/sessions", ...DELETE)

  app.onError((error, context) => {
    if (!(error instanceof SystemHTTPException)) throw error
    return context.json({ error: error.detail, code: error.code, ...error.metadata }, error.status)
  })

  return app
}

describe("System Session HTTP", () => {
  test("password認証・検証・rotation・reuse検知・冪等失効をcanonical Systemで実行する", async () => {
    const fixture = await SystemSessionTestContext.create()
    const passwordHash = await hashPassword(password, pepper)
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(accountId, issuedAt.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('69157852-80fb-427d-8ef4-8047bd2d8c6a', ?1, 'password', ?2, ?3, ?3, NULL)`)
      .bind(accountId, subject, issuedAt.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES ('69157852-80fb-427d-8ef4-8047bd2d8c6a', ?1, ?2, ?2, ?2)`)
      .bind(passwordHash, issuedAt.getTime())
      .run()

    const app = createApp()
    const requestAtIssue = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: issuedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const requestAtRotation = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: rotatedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const requestAtRevocation = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: revokedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const issueClient = hc<typeof app>("http://system.test", { fetch: requestAtIssue })
    const rotationClient = hc<typeof app>("http://system.test", { fetch: requestAtRotation })
    const revocationClient = hc<typeof app>("http://system.test", { fetch: requestAtRevocation })

    const issued = await issueClient.system.sessions.$post({
      json: { subject, password },
    })
    expect(issued.status).toBe(201)
    const issuedBody = await issued.json()
    expect("access_token" in issuedBody).toBe(true)
    expect("refresh_token" in issuedBody).toBe(true)
    if (!("access_token" in issuedBody) || !("refresh_token" in issuedBody)) return
    expect(issuedBody).toMatchObject({ account_id: accountId })

    const rotated = await rotationClient.system.sessions.$patch({
      json: { refresh_token: issuedBody.refresh_token },
    })
    expect(rotated.status).toBe(200)
    const rotatedBody = await rotated.json()
    expect("access_token" in rotatedBody).toBe(true)
    expect("refresh_token" in rotatedBody).toBe(true)
    if (!("access_token" in rotatedBody) || !("refresh_token" in rotatedBody)) return
    expect(rotatedBody.access_token).not.toBe(issuedBody.access_token)
    expect(rotatedBody.refresh_token).not.toBe(issuedBody.refresh_token)

    const reused = await revocationClient.system.sessions.$patch({
      json: { refresh_token: issuedBody.refresh_token },
    })
    expect(Number(reused.status)).toBe(401)

    const familyRevoked = await revocationClient.system.sessions.$patch({
      json: { refresh_token: rotatedBody.refresh_token },
    })
    expect(Number(familyRevoked.status)).toBe(401)

    const logout = await revocationClient.system.sessions.$delete({
      json: { refresh_token: rotatedBody.refresh_token },
    })
    expect(logout.status).toBe(204)
  })

  test("未知subject・誤password・runtime不備を同じ安全な境界へ閉じる", async () => {
    const fixture = await SystemSessionTestContext.create()
    const app = createApp()
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        NOW: issuedAt.toISOString(),
        PEPPER_SECRET: pepper,
      })
    const client = hc<typeof app>("http://system.test", { fetch: request })

    const unknown = await client.system.sessions.$post({
      json: { subject: "unknown@example.com", password: "wrong-password" },
    })
    expect(Number(unknown.status)).toBe(401)
    expect((await unknown.json()) as unknown).toEqual({
      error: "invalid credentials",
      code: "invalid_credentials",
    })

    expect(
      (
        await app.request(
          "/system/sessions",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ subject, password }),
          },
          { DB: fixture.context.env.DB, NOW: issuedAt.toISOString() },
        )
      ).status,
    ).toBe(503)
    expect(
      (
        await app.request(
          "/system/sessions",
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refresh_token: "short" }),
          },
          { DB: fixture.context.env.DB },
        )
      ).status,
    ).toBe(400)
  })
  test("refresh tokenをBearer credentialとして受け付けるGETを公開しない", () => {
    expect("GET" in systemSessionsRoute).toBe(false)
  })

  test("未知subjectと誤passwordを同じdenied監査として記録しsubjectを残さない", async () => {
    const fixture = await SystemSessionTestContext.create()
    const passwordHash = await hashPassword(password, pepper)
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(accountId, issuedAt.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES ('69157852-80fb-427d-8ef4-8047bd2d8c6a', ?1, 'password', ?2, ?3, ?3, NULL)`)
      .bind(accountId, subject, issuedAt.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES ('69157852-80fb-427d-8ef4-8047bd2d8c6a', ?1, ?2, ?2, ?2)`)
      .bind(passwordHash, issuedAt.getTime())
      .run()
    const app = createApp()
    const client = hc<typeof app>("http://system.test", {
      fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
        app.request(input, init, {
          DB: fixture.context.env.DB,
          JWT_SECRET: jwtSecret,
          NOW: issuedAt.toISOString(),
          PEPPER_SECRET: pepper,
        }),
    })

    const unknown = await client.system.sessions.$post({
      json: { subject: "unknown@example.com", password },
    })
    const wrong = await client.system.sessions.$post({
      json: { subject, password: "wrong-password" },
    })
    expect(Number(unknown.status)).toBe(401)
    expect(Number(wrong.status)).toBe(401)
    expect(await unknown.json()).toEqual(await wrong.json())

    const audits = (
      await fixture.database
        .prepare(`SELECT actor_account_id, action, target_type, target_id, outcome, reason_code,
                authorization_json, before_json, after_json, metadata_json, occurred_at
         FROM system_audit_events
         ORDER BY rowid`)
        .all<Record<string, unknown>>()
    ).results
    const denied = {
      actor_account_id: null,
      action: "auth.session.password_login_denied",
      target_type: "session",
      target_id: null,
      outcome: "denied",
      reason_code: "invalid_credentials",
      authorization_json: null,
      before_json: null,
      after_json: null,
      metadata_json: null,
      occurred_at: issuedAt.getTime(),
    }
    expect(audits).toEqual([denied, denied])
  })

  test("denied監査を記録できないpassword拒否はfail closedにする", async () => {
    const fixture = await SystemSessionTestContext.create()
    await execSql(fixture.database, "DROP TABLE system_audit_events")
    const app = createApp()
    const response = await app.request(
      "/system/sessions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject: "unknown@example.com", password }),
      },
      { DB: fixture.context.env.DB, NOW: issuedAt.toISOString(), PEPPER_SECRET: pepper },
    )
    expect(response.status).toBe(503)
  })
})

describe("System Session HTTP の二段階認証", () => {
  test("二段階認証が有効な Account は、パスワードだけでは session を発行しない", async () => {
    const fixture = await SystemSessionTestContext.create()
    const totpAccountId = "6d1f0b9e-2c3a-4b5d-8e7f-9a0b1c2d3e4f"
    const totpSubject = "totp-person@example.com"
    const identityId = "0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f"
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(totpAccountId, issuedAt.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES (?1, ?2, 'password', ?3, ?4, ?4, NULL)`)
      .bind(identityId, totpAccountId, totpSubject, issuedAt.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?3, ?3)`)
      .bind(identityId, await hashPassword(password, pepper), issuedAt.getTime())
      .run()

    const totpContext = {
      env: { DB: fixture.context.env.DB },
      var: {
        database: drizzle(fixture.context.env.DB, { schema: systemCoreSchema }),
        now: () => issuedAt,
      },
    }
    const enrollment = await new BeginSystemTotpEnrollment(totpContext).execute({
      accountId: zAccountId.parse(totpAccountId),
      keyMaterial: pepper,
      issuer: "Example",
      accountName: totpSubject,
    })
    if (enrollment instanceof Error || "kind" in enrollment) throw new Error("enrollment failed")
    const enableCode = await generateSystemTotpCode(enrollment.secret, systemTotpStepAt(issuedAt))
    if (enableCode instanceof Error) throw enableCode
    const enabled = await new EnableSystemTotp(totpContext).execute({
      accountId: zAccountId.parse(totpAccountId),
      code: enableCode,
      keyMaterial: pepper,
    })
    if (enabled instanceof Error || "kind" in enabled) throw new Error("activation failed")

    const loginAt = new Date(issuedAt.getTime() + 30_000)
    const app = createApp()
    const request = (body: unknown) =>
      app.request(
        "/system/sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        {
          DB: fixture.context.env.DB,
          JWT_SECRET: jwtSecret,
          NOW: loginAt.toISOString(),
          PEPPER_SECRET: pepper,
        },
      )

    const withoutCode = await request({ subject: totpSubject, password })
    expect(withoutCode.status).toBe(401)
    expect(await withoutCode.json()).toMatchObject({ code: "totp_code_required" })

    const wrongCode = await request({ subject: totpSubject, password, totp_code: "000000" })
    expect(wrongCode.status).toBe(401)
    expect(await wrongCode.json()).toMatchObject({ code: "invalid_credentials" })

    const code = await generateSystemTotpCode(enrollment.secret, systemTotpStepAt(loginAt))
    if (code instanceof Error) throw code
    const issued = await request({ subject: totpSubject, password, totp_code: code })
    expect(issued.status).toBe(201)
    expect(await issued.json()).toMatchObject({ account_id: totpAccountId })
  })
})
