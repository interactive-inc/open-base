import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.cli-sessions"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const jwtSecret = "cli-session-route-jwt-secret"

async function createFixture() {
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(`INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES ('1cb0c8e2-74ea-4cf3-b33a-321991689e26', 'active', 0, ?1, ?1)`)
    .bind(now.getTime())
    .run()
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/cli-sessions", ...POST)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: jwtSecret,
      }),
  })

  return Object.freeze({ client, fixture })
}

async function seedCode(
  fixture: SystemSessionTestContext,
  code: string,
  expiresAt = now.getTime() + 60_000,
): Promise<void> {
  const codeHash = await systemLoginCodeHash(code)
  if (codeHash instanceof Error) throw codeHash
  await fixture.database
    .prepare(`INSERT INTO system_cli_login_codes
         (code_hash, account_id, created_at, expires_at)
       VALUES (?1, '1cb0c8e2-74ea-4cf3-b33a-321991689e26', ?2, ?3)`)
    .bind(codeHash, Math.min(now.getTime(), expiresAt - 1), expiresAt)
    .run()
}

describe("POST /system/cli-sessions", () => {
  test("exchanges a one-time code for a canonical System Session", async () => {
    const { client, fixture } = await createFixture()
    await seedCode(fixture, "raw-cli-code")

    const response = await client.system["cli-sessions"].$post({
      json: { code: "raw-cli-code" },
    })

    expect(response.status).toBe(201)
    const body = await response.json()
    if (!("account_id" in body)) throw new Error("expected issued System Session")
    expect(String(body.account_id)).toBe("1cb0c8e2-74ea-4cf3-b33a-321991689e26")
    expect(body.access_token.length > 0).toBe(true)
    expect(body.refresh_token.length).toBe(64)
    expect(body.session_id.length > 0).toBe(true)
    expect(body.expires_at).toBe("2026-01-08T00:00:00.000Z")
    expect(
      (
        await fixture.database
          .prepare("SELECT code_hash FROM system_cli_login_codes")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
    expect(
      (
        await fixture.database
          .prepare("SELECT action, reason_code FROM system_audit_events")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([{ action: "auth.session.create", reason_code: null }])
  })

  test("consumes a code exactly once", async () => {
    const { client, fixture } = await createFixture()
    await seedCode(fixture, "single-use-cli-code")

    const first = await client.system["cli-sessions"].$post({
      json: { code: "single-use-cli-code" },
    })
    const second = await client.system["cli-sessions"].$post({
      json: { code: "single-use-cli-code" },
    })

    expect(first.status).toBe(201)
    expect(Number(second.status)).toBe(401)
  })

  test("rejects an unknown, expired, or empty code", async () => {
    const unknown = await createFixture()
    const expired = await createFixture()
    const empty = await createFixture()
    await seedCode(expired.fixture, "expired-cli-code", now.getTime() - 1)

    const unknownResponse = await unknown.client.system["cli-sessions"].$post({
      json: { code: "unknown-cli-code" },
    })
    const expiredResponse = await expired.client.system["cli-sessions"].$post({
      json: { code: "expired-cli-code" },
    })
    const emptyResponse = await empty.client.system["cli-sessions"].$post({
      json: { code: "" },
    })

    expect(Number(unknownResponse.status)).toBe(401)
    expect(Number(expiredResponse.status)).toBe(401)
    expect(Number(emptyResponse.status)).toBe(400)
  })

  test("rejects when the System AccountEntity is suspended after code issuance", async () => {
    const { client, fixture } = await createFixture()
    await seedCode(fixture, "suspended-account-code")
    await execSql(
      fixture.database,
      `
      UPDATE system_accounts
      SET status = 'suspended', token_version = token_version + 1, updated_at = updated_at + 1
      WHERE id = '1cb0c8e2-74ea-4cf3-b33a-321991689e26';
    `,
    )

    const response = await client.system["cli-sessions"].$post({
      json: { code: "suspended-account-code" },
    })

    expect(Number(response.status)).toBe(401)
    expect(
      (
        await fixture.database
          .prepare("SELECT id FROM system_sessions")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
    expect(
      (
        await fixture.database
          .prepare("SELECT action FROM system_audit_events")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
  })
})
