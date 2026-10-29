import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { readFileSync } from "node:fs"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST as CLI } from "@system/interface/routes/system.cli-sessions"
import { POST as BROWSER } from "@system/interface/routes/system.browser-sessions"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CreateSystemCliLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-cli-login-code.adapter"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { ConsumeSystemCliLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-cli-login-code.adapter"
import { ConsumeSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-browser-login-code.adapter"

setDefaultTimeout(30_000)
const accountId = zAccountId.parse("fcd3b186-db56-4b04-8df7-acf9afd0c292")
const now = new Date("2030-01-01T00:00:00Z")
async function fixture(kind: string) {
  const database = await createLocalD1Database({
    schema: readFileSync(
      new URL("../infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ),
  })
  await database
    .prepare(
      "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,?2,?2)",
    )
    .bind(accountId, now.getTime() - 1000)
    .run()
  const code = "example-code"
  const hash = await systemLoginCodeHash(code)
  if (hash instanceof Error) throw hash
  const table = kind === "cli" ? "system_cli_login_codes" : "system_browser_login_codes"
  const context = { env: { DB: database } }
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (c, next) => {
      c.set("now", () => now)
      await next()
    })
    .post("/system/cli-sessions", ...CLI)
    .post("/system/browser-sessions", ...BROWSER)
  return {
    database,
    context,
    seed: async (version = 0, createdAt = now.getTime()) => {
      await database
        .prepare(
          `INSERT INTO ${table}(code_hash,account_id,token_version,created_at,expires_at) VALUES (?1,?2,?3,?4,?5)`,
        )
        .bind(hash, accountId, version, createdAt, createdAt + 60_000)
        .run()
    },
    bump: async () => {
      await database
        .prepare(
          "UPDATE system_accounts SET token_version=token_version+1,updated_at=?2 WHERE id=?1",
        )
        .bind(accountId, now.getTime())
        .run()
    },
    create: (tokenVersion: number) => {
      const input = {
        codeHash: hash,
        accountId,
        tokenVersion,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      }
      return kind === "cli"
        ? new CreateSystemCliLoginCodeAdapter(context).createSystemCliLoginCode(input)
        : new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode(input)
    },
    exchange: () =>
      app.request(
        `/system/${kind}-sessions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        },
        { DB: database, JWT_SECRET: "login-code-test-jwt-secret" },
      ),
    sessions: () =>
      database.prepare("SELECT count(*) AS count FROM system_sessions").first<number>("count"),
  }
}
for (const kind of ["cli", "browser"]) {
  test(`${kind} codeはAccountの認証版を更新した後にsessionを作れない`, async () => {
    const f = await fixture(kind)
    await f.seed()
    await f.bump()
    expect((await f.exchange()).status).toBe(401)
    expect(await f.sessions()).toBe(0)
  })
  test(`${kind} codeは現在の非zero認証版で一度だけsessionを作る`, async () => {
    const f = await fixture(kind)
    await f.bump()
    expect(await f.create(1)).toBeNull()
    expect((await f.exchange()).status).toBe(201)
    expect((await f.exchange()).status).toBe(401)
    expect(await f.sessions()).toBe(1)
    expect(
      await f.database
        .prepare("SELECT token_version FROM system_sessions")
        .first<number>("token_version"),
    ).toBe(1)
  })
  test(`${kind} codeは発行前に認証版が変わると保存も成功監査もしない`, async () => {
    const f = await fixture(kind)
    await f.bump()
    expect(await f.create(0)).toBeInstanceOf(Error)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM system_audit_events")
        .first<number>("count"),
    ).toBe(0)
    expect((await f.exchange()).status).toBe(401)
    expect(await f.sessions()).toBe(0)
  })
  test(`${kind} codeの消費後に認証版が変わっても新しい版へ乗り換えない`, async () => {
    const f = await fixture(kind)
    await f.seed()
    const cli = new ConsumeSystemCliLoginCodeAdapter(f.context).consumeSystemCliLoginCode.bind(
      new ConsumeSystemCliLoginCodeAdapter(f.context),
    )
    const browser = new ConsumeSystemBrowserLoginCodeAdapter(
      f.context,
    ).consumeSystemBrowserLoginCode.bind(new ConsumeSystemBrowserLoginCodeAdapter(f.context))
    const spy =
      kind === "cli"
        ? spyOn(
            ConsumeSystemCliLoginCodeAdapter.prototype,
            "consumeSystemCliLoginCode",
          ).mockImplementation(async (...args) => {
            const result = await cli(...args)
            await f.bump()
            return result
          })
        : spyOn(
            ConsumeSystemBrowserLoginCodeAdapter.prototype,
            "consumeSystemBrowserLoginCode",
          ).mockImplementation(async (...args) => {
            const result = await browser(...args)
            await f.bump()
            return result
          })
    try {
      expect((await f.exchange()).status).toBe(401)
      expect(await f.sessions()).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })
  test(`${kind} codeは有効期間の開始前に消費できない`, async () => {
    const f = await fixture(kind)
    await f.seed(0, now.getTime() + 1000)
    expect((await f.exchange()).status).toBe(401)
    expect(await f.sessions()).toBe(0)
  })
}
