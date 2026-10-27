import { afterEach, expect, test } from "bun:test"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { schema } from "../../../../.void/better-auth-schema"
import defineAuth from "@/auth"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

const origin = "https://auth.example.test"
const servers: ReturnType<typeof Bun.serve>[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) await server.stop(true)
})

async function fixture() {
  const database = await createLocalD1Database()
  const accountId = crypto.randomUUID()
  const now = Date.now()
  await database.batch([
    database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 2, ?2, ?2)",
      )
      .bind(accountId, now),
    database
      .prepare(
        "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at) VALUES (?1, ?2, 'oidc', 'known-subject', ?3, ?3)",
      )
      .bind(crypto.randomUUID(), accountId, now),
  ])
  const keys = await generateKeyPair("EdDSA", { crv: "Ed25519" })
  const publicKey = { ...(await exportJWK(keys.publicKey)), kid: "test-key", alg: "EdDSA" }
  const state = {
    nonce: "",
    challenge: "",
    subject: "known-subject",
    authTime: Math.floor(now / 1_000) as number | null,
    pkceVerified: false,
  }
  let issuer = ""
  const server = Bun.serve({
    hostname: "localhost",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/.well-known/openid-configuration")
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
          id_token_signing_alg_values_supported: ["EdDSA"],
        })
      if (url.pathname === "/jwks") return Response.json({ keys: [publicKey] })
      if (url.pathname !== "/token") return new Response(null, { status: 404 })
      const body = new URLSearchParams(await request.text())
      const challenge = Buffer.from(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(body.get("code_verifier") ?? ""),
        ),
      ).toString("base64url")
      state.pkceVerified =
        challenge === state.challenge &&
        body.get("client_id") === "web-client" &&
        body.get("redirect_uri") === `${origin}/api/auth/oidc/callback`
      if (!state.pkceVerified) return new Response(null, { status: 400 })
      const idToken = await new SignJWT({
        nonce: state.nonce,
        ...(state.authTime === null ? {} : { auth_time: state.authTime }),
      })
        .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
        .setIssuer(issuer)
        .setAudience("web-client")
        .setSubject(state.subject)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(keys.privateKey)
      return Response.json({ id_token: idToken })
    },
  })
  servers.push(server)
  issuer = `http://localhost:${server.port}`
  const auth = betterAuth(
    defineAuth({
      dialect: "sqlite",
      request: new Request(origin),
      env: {
        DB: database,
        SIGN_IN_METHOD: "oidc",
        IDENTITY_ISSUER: issuer,
        OIDC_CLIENT_ID: "web-client",
      },
      defaults: {
        baseURL: origin,
        secret: "test-only-session-secret-not-for-deployment",
        trustedOrigins: [origin],
        database: drizzleAdapter(drizzle(database, { schema }), { provider: "sqlite", schema }),
      },
    }),
  )
  const call = (path: string, cookie?: string) =>
    auth.handler(
      new Request(`${origin}/api/auth${path}`, { headers: cookie === undefined ? {} : { cookie } }),
    )
  const start = async (fresh = false) => {
    const response = await call(`/oidc/sign-in?callbackURL=%2F&${fresh ? "prompt=login" : ""}`)
    expect(response.status).toBe(302)
    const url = new URL(response.headers.get("location")!)
    state.nonce = url.searchParams.get("nonce")!
    state.challenge = url.searchParams.get("code_challenge")!
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    if (fresh) expect(url.searchParams.get("max_age")).toBe("0")
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    return {
      cookie,
      callback: `/oidc/callback?state=${encodeURIComponent(url.searchParams.get("state")!)}&code=test-code`,
    }
  }
  return { accountId, database, state, start, call }
}

test("実際の認可コード交換でPKCEとnonceを検証し、登録済みの主体へ一度だけセッションを作る", async () => {
  const f = await fixture()
  const { cookie, callback } = await f.start()
  const response = await f.call(callback, cookie)
  expect(response.headers.get("location")).toBe("/")
  expect(f.state.pkceVerified).toBe(true)
  expect(
    await f.database
      .prepare('SELECT "userId", "accountTokenVersion", "authenticationMethod" FROM session')
      .first(),
  ).toEqual({ userId: f.accountId, accountTokenVersion: 2, authenticationMethod: "oidc" })
  const replay = await f.call(callback, cookie)
  expect(replay.headers.get("location")).toContain("error=invalid_state")
  expect(await f.database.prepare("SELECT COUNT(*) AS total FROM session").first("total")).toBe(1)
}, 30_000)

test("stateとnonceの不一致、未登録の主体ではセッションを作らない", async () => {
  const f = await fixture()
  const first = await f.start()
  expect(
    (await f.call(first.callback.replace(/state=[^&]+/, "state=other"), first.cookie)).headers.get(
      "location",
    ),
  ).toContain("error=invalid_state")
  const second = await f.start()
  f.state.nonce = "other-nonce"
  expect((await f.call(second.callback, second.cookie)).headers.get("location")).toContain(
    "error=failed",
  )
  const third = await f.start()
  f.state.subject = "unknown-subject"
  expect((await f.call(third.callback, third.cookie)).headers.get("location")).toContain(
    "error=no_account",
  )
  expect(await f.database.prepare("SELECT COUNT(*) AS total FROM session").first("total")).toBe(0)
}, 30_000)

test("再認証では発行者の新しい認証時刻を必須にする", async () => {
  const f = await fixture()
  for (const authTime of [null, Math.floor(Date.now() / 1_000) - 301]) {
    const { cookie, callback } = await f.start(true)
    f.state.authTime = authTime
    expect((await f.call(callback, cookie)).headers.get("location")).toContain("error=failed")
  }
  expect(await f.database.prepare("SELECT COUNT(*) AS total FROM session").first("total")).toBe(0)
}, 30_000)
