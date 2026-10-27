import { hashPassword } from "@system/lib/auth/hash-password"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { ResolveBearerAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { SystemHTTPException } from "@system/interface/errors"
import {
  DELETE,
  PATCH,
  POST,
  type SystemSessionHttpEnvironment,
} from "@system/interface/routes/system.sessions"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { testLiteralId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const legacySessionFamilyId = testLiteralId("legacy-family")

const accountId = "29acdce0-9491-410f-907f-7712dbca3070"
const subject = "person@example.com"
const password = "correct-password"
const pepper = "system-session-lifetime-pepper"
const jwtSecret = "system-session-lifetime-test-secret"
const day = 24 * 60 * 60 * 1_000
// access tokenの署名検証は実時刻で行うため、発行時刻も実時刻に合わせる。
const issuedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000)

type SessionBody = Readonly<{ access_token: string; refresh_token: string; expires_at: string }>

async function createFixture() {
  const fixture = await SystemSessionTestContext.create()
  const passwordHash = await hashPassword(password, pepper)
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
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

  const app = new Hono<SystemSessionHttpEnvironment>()
    .post("/system/sessions", ...POST)
    .patch("/system/sessions", ...PATCH)
    .delete("/system/sessions", ...DELETE)
  app.onError((error, context) => {
    if (!(error instanceof SystemHTTPException)) throw error
    return context.json({ error: error.detail, code: error.code }, error.status)
  })

  const send = (
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
    at: Date,
    maxLifetimeSeconds?: string,
  ) =>
    app.request(
      "/system/sessions",
      { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
        NOW: at.toISOString(),
        PEPPER_SECRET: pepper,
        ...(maxLifetimeSeconds === undefined
          ? {}
          : { SYSTEM_SESSION_MAX_LIFETIME_SECONDS: maxLifetimeSeconds }),
      },
    )
  const login = async (at: Date, maxLifetimeSeconds?: string) => {
    const response = await send("POST", { subject, password }, at, maxLifetimeSeconds)
    expect(response.status).toBe(201)
    return (await response.json()) as SessionBody
  }
  const refresh = (refreshToken: string, at: Date, maxLifetimeSeconds?: string) =>
    send("PATCH", { refresh_token: refreshToken }, at, maxLifetimeSeconds)
  const bearer = (accessToken: string) =>
    new ResolveBearerAccountAdapter({
      env: { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret },
    }).resolve({ token: accessToken, now: new Date() })
  const sessions = async () =>
    (
      await fixture.database
        .prepare(`SELECT family_id, authenticated_at, created_at, expires_at, revoked_at
         FROM system_sessions ORDER BY created_at, rowid`)
        .all<{
          family_id: string
          authenticated_at: number | null
          created_at: number
          expires_at: number
          revoked_at: number | null
        }>()
    ).results
  const rotationDenials = async () =>
    (
      await fixture.database
        .prepare(`SELECT reason_code FROM system_audit_events
         WHERE action = 'auth.session.rotate' AND outcome = 'denied' ORDER BY rowid`)
        .all<{ reason_code: string | null }>()
    ).results.map((row) => row.reason_code)

  return { fixture, send, login, refresh, bearer, sessions, rotationDenials }
}

describe("System Session absolute lifetime", () => {
  test("refreshは認証時刻を引き継ぎ、絶対寿命を超えたrefreshを拒否して再ログインを求める", async () => {
    const c = await createFixture()
    const maxLifetime = String((2 * day) / 1_000)

    const issued = await c.login(issuedAt, maxLifetime)
    // TTL（既定7日）より短い絶対寿命で、初回のexpiresAtも寿命の終わりに揃う。
    expect(Date.parse(issued.expires_at)).toBe(issuedAt.getTime() + 2 * day)

    const rotated = await c.refresh(
      issued.refresh_token,
      new Date(issuedAt.getTime() + day),
      maxLifetime,
    )
    expect(rotated.status).toBe(200)
    const rotatedBody = (await rotated.json()) as SessionBody
    expect(Date.parse(rotatedBody.expires_at)).toBe(issuedAt.getTime() + 2 * day)
    expect((await c.sessions()).map((row) => row.authenticated_at)).toEqual([
      issuedAt.getTime(),
      issuedAt.getTime(),
    ])

    const expired = await c.refresh(
      rotatedBody.refresh_token,
      new Date(issuedAt.getTime() + 2 * day),
      maxLifetime,
    )
    expect(expired.status).toBe(401)
    expect(await c.rotationDenials()).toEqual(["session_lifetime_exceeded"])
    expect((await c.sessions()).every((row) => row.revoked_at !== null)).toBe(true)

    const relogin = await c.login(new Date(issuedAt.getTime() + 2 * day), maxLifetime)
    expect((await c.sessions()).at(-1)).toMatchObject({
      authenticated_at: issuedAt.getTime() + 2 * day,
      revoked_at: null,
    })
    expect(relogin.refresh_token).not.toBe(rotatedBody.refresh_token)
  })

  test("設定を短くすると、既に長いexpiresAtを持つfamilyもrefreshで延長できない", async () => {
    const c = await createFixture()
    const issued = await c.login(issuedAt)
    expect(Date.parse(issued.expires_at)).toBe(issuedAt.getTime() + 7 * day)

    const response = await c.refresh(
      issued.refresh_token,
      new Date(issuedAt.getTime() + day),
      String(day / 1_000),
    )
    expect(response.status).toBe(401)
    expect(await c.rotationDenials()).toEqual(["session_lifetime_exceeded"])
  })

  test.each(["", "0", "-1", "1.5", "abc", "99999999999999"])(
    "絶対寿命の設定 %p は発行もrefreshも止める",
    async (value) => {
      const c = await createFixture()
      const issued = await c.login(issuedAt)

      expect((await c.send("POST", { subject, password }, issuedAt, value)).status).toBe(503)
      expect((await c.refresh(issued.refresh_token, issuedAt, value)).status).toBe(503)
      expect(await c.sessions()).toHaveLength(1)
    },
  )

  test("起点を持たない既存行は、同じfamilyの最初の作成時刻から寿命を数える", async () => {
    const c = await createFixture()
    const material = new SystemSessionMaterialService()
    const rawToken = "a1".repeat(32)
    const tokenHash = await material.hashRawToken(rawToken)
    if (tokenHash instanceof Error) throw tokenHash
    const familyStart = issuedAt.getTime() - 3 * day
    await c.fixture.database
      .prepare(`INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version,
            created_at, expires_at, rotated_at, revoked_at)
         VALUES
           ('d2b167e6-a7bd-44f6-a72e-6b62792fd895', ?1, '${legacySessionFamilyId}', ?2, 0, ?3, ?4, ?5, NULL),
           ('3761449c-4d30-4eb9-9894-9d4b49e7a515', ?1, '${legacySessionFamilyId}', ?6, 0, ?5, ?7, NULL, NULL)`)
      .bind(
        accountId,
        "b".repeat(64),
        familyStart,
        familyStart + 7 * day,
        familyStart + day,
        tokenHash,
        familyStart + 8 * day,
      )
      .run()

    expect((await c.refresh(rawToken, issuedAt, String((2 * day) / 1_000))).status).toBe(401)
    expect(await c.rotationDenials()).toEqual(["session_lifetime_exceeded"])
  })

  test("起点を持たない既存行も寿命内ならrefreshでき、後継は最初の作成時刻を引き継ぐ", async () => {
    const c = await createFixture()
    const material = new SystemSessionMaterialService()
    const rawToken = "c3".repeat(32)
    const tokenHash = await material.hashRawToken(rawToken)
    if (tokenHash instanceof Error) throw tokenHash
    const familyStart = issuedAt.getTime() - day
    await c.fixture.database
      .prepare(`INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version,
            created_at, expires_at, rotated_at, revoked_at)
         VALUES ('d2b167e6-a7bd-44f6-a72e-6b62792fd895', ?1, '${legacySessionFamilyId}', ?2, 0, ?3, ?4, NULL, NULL)`)
      .bind(accountId, tokenHash, familyStart, familyStart + 7 * day)
      .run()

    expect((await c.refresh(rawToken, issuedAt)).status).toBe(200)
    expect((await c.sessions()).at(-1)).toMatchObject({
      family_id: legacySessionFamilyId,
      authenticated_at: familyStart,
    })
  })
})

describe("System Session logout", () => {
  test("logoutはrefresh tokenだけでなく、そのfamilyへ発行済みのaccess tokenも拒否させる", async () => {
    const c = await createFixture()
    const issued = await c.login(issuedAt)
    expect(await c.bearer(issued.access_token)).toMatchObject({ kind: "accepted", accountId })

    const rotated = await c.refresh(issued.refresh_token, issuedAt)
    expect(rotated.status).toBe(200)
    const rotatedBody = (await rotated.json()) as SessionBody
    expect(await c.bearer(rotatedBody.access_token)).toMatchObject({ kind: "accepted" })

    const logout = await c.send("DELETE", { refresh_token: rotatedBody.refresh_token }, issuedAt)
    expect(logout.status).toBe(204)

    expect(await c.bearer(issued.access_token)).toEqual({
      kind: "rejected",
      reason: "invalid token",
    })
    expect(await c.bearer(rotatedBody.access_token)).toEqual({
      kind: "rejected",
      reason: "invalid token",
    })
    expect((await c.refresh(rotatedBody.refresh_token, issuedAt)).status).toBe(401)
  })

  test("別のfamilyのlogoutは、同じAccountの他のSessionのaccess tokenを失効させない", async () => {
    const c = await createFixture()
    const first = await c.login(issuedAt)
    const second = await c.login(issuedAt)

    expect((await c.send("DELETE", { refresh_token: first.refresh_token }, issuedAt)).status).toBe(
      204,
    )
    expect(await c.bearer(first.access_token)).toMatchObject({ kind: "rejected" })
    expect(await c.bearer(second.access_token)).toMatchObject({ kind: "accepted" })
  })

  test("並行refreshは一方だけ成功し、再利用検知でfamilyのaccess tokenもすべて拒否する", async () => {
    const c = await createFixture()
    const issued = await c.login(issuedAt)

    const responses = await Promise.all([
      c.refresh(issued.refresh_token, issuedAt),
      c.refresh(issued.refresh_token, issuedAt),
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([200, 401])
    const winner = responses.find((response) => response.status === 200)
    if (winner === undefined) throw new Error("one refresh must succeed")
    const winnerBody = (await winner.json()) as SessionBody

    expect((await c.sessions()).every((row) => row.revoked_at !== null)).toBe(true)
    expect(await c.bearer(issued.access_token)).toMatchObject({ kind: "rejected" })
    expect(await c.bearer(winnerBody.access_token)).toMatchObject({ kind: "rejected" })
    expect((await c.refresh(winnerBody.refresh_token, issuedAt)).status).toBe(401)
  })
})
