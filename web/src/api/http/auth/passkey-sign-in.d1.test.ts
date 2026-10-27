import { expect, test } from "bun:test"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import { z } from "zod"
import defineAuth from "@/auth"
import { schema } from "../../../../.void/better-auth-schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { issueSystemPasskeyEnrollment } from "@system/interface/operations/issue-system-passkey-enrollment"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SoftwareWebauthnAuthenticator } from "./software-webauthn-authenticator.test-support"

const origin = "https://auth.example.test"
const optionsSchema = z.object({
  challenge: z.string(),
  user: z.object({ id: z.string() }).optional(),
})
async function fixture() {
  const database = await createLocalD1Database()
  const accountId = zAccountId.parse(crypto.randomUUID())
  const identityId = crypto.randomUUID()
  const now = Date.now()
  await database.batch([
    database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, ?2, ?2)",
      )
      .bind(accountId, now),
    database
      .prepare(
        "INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at) VALUES (?1, ?2, 'passkey', ?2, ?3)",
      )
      .bind(identityId, accountId, now),
    database
      .prepare(
        "INSERT INTO system_identity_profiles (identity_id, email, email_verified, updated_at) VALUES (?1, 'you@example.com', 1, ?2)",
      )
      .bind(identityId, now),
  ])
  const auth = betterAuth(
    defineAuth({
      dialect: "sqlite",
      request: new Request(origin),
      env: { DB: database, SIGN_IN_METHOD: "passkey" },
      defaults: {
        baseURL: origin,
        secret: "test-only-session-secret-not-for-deployment",
        trustedOrigins: [origin],
        database: drizzleAdapter(drizzle(database, { schema }), { provider: "sqlite", schema }),
      },
    }),
  )
  function browser() {
    const cookies = new Map<string, string>()
    const call = async (path: string, body?: unknown) => {
      const response = await auth.handler(
        new Request(`${origin}/api/auth${path}`, {
          method: body === undefined ? "GET" : "POST",
          headers: {
            origin,
            "content-type": "application/json",
            cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      )
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(";")[0] ?? ""
        const split = pair.indexOf("=")
        cookies.set(pair.slice(0, split), pair.slice(split + 1))
      }
      return response
    }
    return { call }
  }
  const invite = async () => {
    const result = await issueSystemPasskeyEnrollment(
      { env: { DB: database } },
      { accountId, reason: "recovery", issuedByAccountId: null, now: new Date() },
    )
    if (result instanceof Error || result === "no_identity") throw new Error("invitation failed")
    return result.token
  }
  const enroll = async (client: ReturnType<typeof browser>, token: string, userVerified = true) => {
    const response = await client.call(`/passkey/generate-register-options?context=${token}`)
    expect(response.status).toBe(200)
    const options = optionsSchema.parse(await response.json())
    const authenticator = await SoftwareWebauthnAuthenticator.create(options.user?.id ?? accountId)
    const registered = await client.call("/passkey/verify-registration", {
      name: "Test device",
      createSession: true,
      response: await authenticator.createRegistrationResponse({
        challenge: options.challenge,
        origin,
        rpId: new URL(origin).hostname,
        userVerified,
      }),
    })
    return { authenticator, registered }
  }
  const login = async (
    client: ReturnType<typeof browser>,
    authenticator: SoftwareWebauthnAuthenticator,
    userVerified = true,
  ) => {
    const options = optionsSchema.parse(
      await (await client.call("/passkey/generate-authenticate-options")).json(),
    )
    return client.call("/passkey/verify-authentication", {
      response: await authenticator.createAuthenticationResponse({
        challenge: options.challenge,
        origin,
        rpId: new URL(origin).hostname,
        userVerified,
      }),
    })
  }
  return { database, browser, invite, enroll, login }
}

test("招待から署名付きの鍵を登録し、ログインと復旧で古い鍵・セッションを失効させる", async () => {
  const f = await fixture()
  const first = f.browser()
  const enrolled = await f.enroll(first, await f.invite())
  expect(enrolled.registered.status).toBe(200)
  expect((await f.login(f.browser(), enrolled.authenticator)).status).toBe(200)
  const replacement = await f.enroll(f.browser(), await f.invite())
  expect(replacement.registered.status).toBe(200)
  expect((await first.call("/passkey/list-user-passkeys")).status).toBe(401)
  expect((await f.login(f.browser(), enrolled.authenticator)).status).toBe(401)
  expect((await f.login(f.browser(), replacement.authenticator)).status).toBe(200)
  expect(await f.database.prepare("SELECT COUNT(*) AS total FROM passkey").first("total")).toBe(1)
}, 30_000)

test("認証器で本人確認していない登録とログインを拒否する", async () => {
  const f = await fixture()
  const rejected = await f.enroll(f.browser(), await f.invite(), false)
  expect(rejected.registered.status).toBe(400)
  expect(await f.database.prepare("SELECT COUNT(*) AS total FROM passkey").first("total")).toBe(0)
  const enrolled = await f.enroll(f.browser(), await f.invite())
  expect(enrolled.registered.status).toBe(200)
  expect((await f.login(f.browser(), enrolled.authenticator, false)).status).toBe(401)
}, 30_000)
