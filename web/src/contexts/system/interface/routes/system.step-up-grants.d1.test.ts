import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemHTTPException } from "@system/interface/errors"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.step-up-grants"
import {
  createSystemSessionApplications,
  systemTestSignedInSession,
} from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = zAccountId.parse("6c047840-0ba9-4c7a-8491-8dda0db0dc15")

describe("POST /system/step-up-grants", () => {
  test("直前にパスキーでサインインしたセッションだけに短命grantを発行する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await seedAccount(fixture)
    const issue = (method: "passkey" | "device", authenticatedAt: Date) =>
      createSystemSessionApplications({ context: fixture.context }).issue.execute({
        accountId,
        tokenVersion: 0,
        now,
        method,
        authenticatedAt,
      })

    const fresh = await issue("passkey", new Date(now.getTime() - 60_000))
    if (fresh.kind !== "issued") throw new Error("test session was not issued")
    const issued = await post(fixture, fresh.accessToken)
    expect({ status: issued.status, body: await issued.json() }).toMatchObject({
      status: 201,
      body: { method: "passkey", expires_at: "2026-01-01T00:05:00.000Z" },
    })

    // 5分より前のサインインは、再認証の証拠にならない。
    const stale = await issue("passkey", new Date(now.getTime() - 301_000))
    if (stale.kind !== "issued") throw new Error("test session was not issued")
    expect(Number((await post(fixture, stale.accessToken)).status)).toBe(401)

    // CLIとMCPのデバイス認証のセッションでは再認証できない。
    const device = await issue("device", now)
    if (device.kind !== "issued") throw new Error("test session was not issued")
    expect(Number((await post(fixture, device.accessToken)).status)).toBe(401)

    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM system_audit_events
           WHERE action = 'auth.step_up.issued'`)
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
  })
})

function post(fixture: SystemSessionTestContext, accessToken: string) {
  const app = new Hono<SystemHonoEnv>()
    .use("*", systemTestSignedInSession)
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/step-up-grants", ...POST)
  app.onError((error, context) => {
    if (!(error instanceof SystemHTTPException)) throw error
    return context.json({ code: error.code, detail: error.detail }, error.status)
  })
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, { DB: fixture.context.env.DB }),
    headers: { authorization: `Bearer ${accessToken}` },
  })
  return client.system["step-up-grants"].$post()
}

async function seedAccount(fixture: SystemSessionTestContext): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, ?2, ?2)`)
    .bind(accountId, now.getTime())
    .run()
}
