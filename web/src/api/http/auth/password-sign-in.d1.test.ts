import { describe, expect, test } from "bun:test"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { drizzle } from "drizzle-orm/d1"
import defineAuth from "@/auth"
import { schema } from "../../../../.void/better-auth-schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { bootstrapSystemRoot } from "@system/interface/operations/bootstrap-system-root"
import { hashPassword } from "@system/lib/auth/hash-password"

const origin = "https://auth.example.test"
const pepper = "test-only-password-pepper-not-for-deployment"
const email = "you@example.com"
const password = "test-only-initial-password"

async function fixture(method: "password" | "passkey" | "oidc" = "password") {
  const database = await createLocalD1Database()
  const root = await bootstrapSystemRoot(
    database,
    { hash: (value) => hashPassword(value, pepper) },
    { email, password, now: new Date() },
  )
  if (root instanceof Error || root.kind !== "created") throw new Error("fixture bootstrap failed")
  const auth = betterAuth(
    defineAuth({
      dialect: "sqlite",
      request: new Request(origin),
      env: { DB: database, SIGN_IN_METHOD: method, PEPPER_SECRET: pepper },
      defaults: {
        baseURL: origin,
        secret: "test-only-session-secret-not-for-deployment",
        database: drizzleAdapter(drizzle(database, { schema }), { provider: "sqlite", schema }),
        trustedOrigins: [origin],
      },
    }),
  )
  const call = (path: string, body: unknown, cookie?: string) =>
    auth.handler(
      new Request(`${origin}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify(body),
      }),
    )
  return { auth, call, database, accountId: root.accountId }
}

describe("パスワード方式の実際の認証経路", () => {
  test("現在の資格情報だけでセッションを発行し、失効後の資格追加と委任を拒否する", async () => {
    const { call, database, accountId } = await fixture()
    expect((await call("/sign-in/email", { email, password: "wrong-password" })).status).toBe(401)
    const signedIn = await call("/sign-in/email", { email, password })
    expect(signedIn.status).toBe(200)
    const result = await signedIn.json()
    expect(result).toMatchObject({ user: { id: accountId } })
    const session = await database
      .prepare(
        'SELECT "accountTokenVersion", "authenticationMethod" FROM "session" WHERE "userId" = ?1',
      )
      .bind(accountId)
      .first()
    expect(session).toMatchObject({ accountTokenVersion: 0, authenticationMethod: "password" })
    const cookie = signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    await database
      .prepare(
        "UPDATE system_accounts SET token_version = token_version + 1, updated_at = ?1 WHERE id = ?2",
      )
      .bind(Date.now(), accountId)
      .run()
    expect((await call("/device/approve", { userCode: "ABCDEFGH" }, cookie)).status).toBe(401)
  }, 30_000)

  test("資格情報を変えた後は、認証基盤に写した古いパスワードを使えない", async () => {
    const { call, database, accountId } = await fixture()
    expect((await call("/sign-in/email", { email, password })).status).toBe(200)
    const replacement = "test-only-replacement-password"
    await database
      .prepare(
        "UPDATE system_password_credentials SET password_hash = ?1, changed_at = ?2, updated_at = ?2 WHERE identity_id IN (SELECT id FROM system_identity_bindings WHERE account_id = ?3)",
      )
      .bind(await hashPassword(replacement, pepper), Date.now(), accountId)
      .run()
    expect((await call("/sign-in/email", { email, password })).status).toBe(401)
    expect((await call("/sign-in/email", { email, password: replacement })).status).toBe(200)
  }, 30_000)

  test.each(["passkey", "oidc"] as const)(
    "%s方式では正しいパスワードでもログインさせない",
    async (method) => {
      const { call } = await fixture(method)
      expect((await call("/sign-in/email", { email, password })).status).toBe(404)
      expect((await call("/sign-up/email", { email, password, name: "Test" })).status).toBe(404)
    },
    30_000,
  )
})
