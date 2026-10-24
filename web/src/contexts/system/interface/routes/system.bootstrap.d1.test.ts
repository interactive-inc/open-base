import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.bootstrap"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const bootstrapToken = "system-bootstrap-test-token"

describe("System Bootstrap HTTP", () => {
  test("single-use credentialでCompanyなしのroot Account一式を一度だけ作る", async () => {
    const fixture = await SystemSessionTestContext.create()
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .post("/system/bootstrap", ...POST)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        BOOTSTRAP_TOKEN: bootstrapToken,
      })
    const client = hc<typeof app>("http://system.test", { fetch: request })

    const invalidCredential = await client.system.bootstrap.$post({
      json: {
        token: "wrong-bootstrap-token",
        email: "root@example.com",
      },
    })
    expect(Number(invalidCredential.status)).toBe(401)

    const created = await client.system.bootstrap.$post({
      json: {
        token: bootstrapToken,
        email: "ROOT@example.com",
      },
    })
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect("account_id" in createdBody).toBe(true)
    if (!("account_id" in createdBody)) return
    expect(createdBody.email).toBe("root@example.com")
    // 初期rootはパスワードを持たず、返した招待でパスキーを登録する。
    expect(createdBody.passkey_enrollment.token).toMatch(/^[0-9a-f]{64}$/)
    expect(
      await fixture.database
        .prepare(`SELECT identity.provider, identity.subject, identity.activated_at,
                         enrollment.reason, enrollment.consumed_at
           FROM system_identity_bindings identity
           INNER JOIN system_passkey_enrollments enrollment ON enrollment.identity_id = identity.id
           WHERE identity.account_id = ?1`)
        .bind(createdBody.account_id)
        .first<Record<string, unknown>>(),
    ).toEqual({
      provider: "passkey",
      subject: createdBody.account_id,
      activated_at: null,
      reason: "bootstrap",
      consumed_at: null,
    })
    expect(
      await fixture.database
        .prepare(`SELECT role.key
           FROM system_role_bindings binding
           INNER JOIN system_iam_roles role ON role.id = binding.role_id
           WHERE binding.account_id = ?1 AND binding.revoked_at IS NULL`)
        .bind(createdBody.account_id)
        .first<Record<string, unknown>>(),
    ).toEqual({ key: "system:root" })
    expect(
      (
        await fixture.database
          .prepare(`SELECT permission_key
           FROM system_iam_role_permissions
           ORDER BY permission_key`)
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([
      { permission_key: "iam:read" },
      { permission_key: "iam:write" },
      { permission_key: "system:admin" },
    ])

    const repeated = await client.system.bootstrap.$post({
      json: {
        token: bootstrapToken,
        email: "other@example.com",
      },
    })
    expect(Number(repeated.status)).toBe(409)
    expect(
      await fixture.database
        .prepare("SELECT count(*) AS total FROM system_accounts")
        .first<Record<string, unknown>>(),
    ).toEqual({
      total: 1,
    })
    expect(
      await fixture.database
        .prepare("SELECT action FROM system_audit_events ORDER BY action")
        .all<Record<string, unknown>>()
        .then((rows) => rows.results),
    ).toEqual([
      { action: "auth.passkey_enrollment.issued" },
      { action: "system.bootstrap.completed" },
    ])
  })

  test("bootstrap credential未設定時はvalidatorより先に経路を隠す", async () => {
    const fixture = await SystemSessionTestContext.create()
    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .post("/system/bootstrap", ...POST)
    const response = await app.request(
      "/system/bootstrap",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
      { DB: fixture.context.env.DB },
    )

    expect(response.status).toBe(404)
  })
})
