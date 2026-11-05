import { afterEach, expect, test } from "bun:test"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import { exportJWK, generateKeyPair, SignJWT } from "jose"
import { schema } from "../../../../.void/better-auth-schema"
import defineAuth from "@/auth"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"

const origin = "https://auth.example.test"
const audience = "https://base.example.test"
const servers: ReturnType<typeof Bun.serve>[] = []
afterEach(async () => {
  for (const server of servers.splice(0)) await server.stop(true)
})

async function fixture(signInMethod = "oidc") {
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
  let issuer = ""
  const server = Bun.serve({
    hostname: "localhost",
    port: 0,
    fetch(request) {
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
      return new Response(null, { status: 404 })
    },
  })
  servers.push(server)
  issuer = `http://localhost:${server.port}`
  const accessToken = (subject: string, tokenAudience = audience) =>
    new SignJWT({})
      .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
      .setIssuer(issuer)
      .setAudience(tokenAudience)
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(keys.privateKey)
  const auth = betterAuth(
    defineAuth({
      dialect: "sqlite",
      request: new Request(origin),
      env: {
        DB: database,
        SIGN_IN_METHOD: signInMethod,
        IDENTITY_ISSUER: issuer,
        IDENTITY_ACCESS_TOKEN_ISSUER: issuer,
        IDENTITY_ACCESS_TOKEN_AUDIENCE: audience,
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
  const issueCode = (token: string | null) =>
    auth.handler(
      new Request(`${origin}/api/auth/cli/browser-code`, {
        method: "POST",
        headers: token === null ? {} : { authorization: `Bearer ${token}` },
      }),
    )
  const callback = (code: string) =>
    auth.handler(new Request(`${origin}/api/auth/cli/callback?code=${encodeURIComponent(code)}`))
  return { accountId, database, accessToken, issueCode, callback }
}

test("CLIのaccess tokenを一度だけ使えるcodeに替え、委任のセッションとしてブラウザへ引き継ぐ", async () => {
  const f = await fixture()
  const issued = await f.issueCode(await f.accessToken("known-subject"))
  expect(issued.status).toBe(200)
  const { code } = (await issued.json()) as { code: string }

  const response = await f.callback(code)
  expect(response.status).toBe(302)
  expect(response.headers.get("location")).toBe("/")
  expect(response.headers.getSetCookie().some((value) => value.includes("session_token"))).toBe(
    true,
  )
  expect(
    await f.database
      .prepare('SELECT "userId", "accountTokenVersion", "authenticationMethod" FROM session')
      .first(),
  ).toEqual({ userId: f.accountId, accountTokenVersion: 2, authenticationMethod: "device" })

  const replay = await f.callback(code)
  expect(replay.headers.get("location")).toContain("error=invalid_state")
  expect(await f.database.prepare("SELECT COUNT(*) AS total FROM session").first("total")).toBe(1)
})

test("Base宛てでないtoken、知らない主体、tokenなしにはcodeを出さない", async () => {
  const f = await fixture()
  expect((await f.issueCode(null)).status).toBe(401)
  expect((await f.issueCode(await f.accessToken("known-subject", "web-client"))).status).toBe(401)
  expect((await f.issueCode(await f.accessToken("unknown-subject"))).status).toBe(401)
  expect((await f.issueCode("not-a-jwt")).status).toBe(401)
})

test("OIDC以外の配備では引き継ぎのendpointを使わせない", async () => {
  const f = await fixture("passkey")
  expect((await f.issueCode(await f.accessToken("known-subject"))).status).toBe(404)
  expect((await f.callback("anything")).status).toBe(404)
})
