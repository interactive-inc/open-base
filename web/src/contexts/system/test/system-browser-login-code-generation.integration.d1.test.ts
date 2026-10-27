import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { SystemPasswordResetAdapter } from "@system/infrastructure/adapters/auth/system-password-reset.adapter"
import { SystemHTTPException } from "@system/interface/errors"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST as CREATE_CODE } from "@system/interface/routes/system.browser-login-codes"
import { POST as EXCHANGE_CODE } from "@system/interface/routes/system.browser-sessions"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const secret = "system-browser-login-code-generation-test-secret"
const accountId = zAccountId.parse("6f0f4f3e-2b8d-4c41-9a51-0d8f0c7b2a11")
const adminAccountId = zAccountId.parse("0b5f7c1a-93e4-4d2f-8b6a-5e1c2d3f4a22")
const identityId = zIdentityId.parse("c2a4e6f8-1b3d-4f5a-9c7e-2d4f6a8b0c33")
const adminRoleId = "9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c44"
const codeResponseSchema = z.object({ code: z.string(), expires_in: z.number() })

async function createFixture() {
  const database = await createSystemAttachmentTestDatabase()
  const clock = { now: new Date() }
  const at = clock.now.getTime() - 1_000
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at)
       VALUES ('${accountId}', 'active', 0, NULL, ${at}, ${at}),
              ('${adminAccountId}', 'active', 0, NULL, ${at}, ${at});
     INSERT INTO system_identity_bindings (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('${identityId}', '${accountId}', 'password', 'user@example.com', ${at}, ${at}, NULL);
     INSERT INTO system_password_credentials (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES ('${identityId}', 'old-password-hash-value', ${at}, ${at}, ${at});
     INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
       VALUES ('${adminRoleId}', 'admin:role', 'custom', 'Admin', ${at}, ${at});
     INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('${adminRoleId}', 'system:admin');
     INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
       VALUES ('7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c55', '${adminAccountId}', '${adminRoleId}', ${at});`,
  )

  const applications = createSystemSessionApplications({
    context: { env: { DB: database } },
    jwtSecret: secret,
    sessionTtlMilliseconds: 3_600_000,
  })
  if (applications instanceof Error) throw applications
  const session = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: clock.now,
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (session instanceof Error || session.kind !== "issued") {
    throw new Error("session fixture was not issued")
  }

  return { database, clock, accessToken: session.accessToken }
}

type Fixture = Awaited<ReturnType<typeof createFixture>>

/** 入口の認証を通った後、コードを保存する直前に割り込む処理を差し込んだ公開経路を作る。 */
function createApp(fixture: Fixture, beforeStore: () => Promise<void>) {
  return systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => fixture.clock.now)
      await next()
    })
    .onError((error, context) =>
      error instanceof SystemHTTPException
        ? context.json({ error: error.code }, error.status)
        : context.json({ error: "internal" }, 500),
    )
    .post(
      "/system/browser-login-codes",
      CREATE_CODE[0],
      async (_context, next) => {
        await beforeStore()
        await next()
      },
      CREATE_CODE[1],
    )
    .post("/system/browser-sessions", ...EXCHANGE_CODE)
}

async function requestCode(fixture: Fixture, beforeStore: () => Promise<void>) {
  const response = await createApp(fixture, beforeStore).request(
    "/system/browser-login-codes",
    { method: "POST", headers: { authorization: `Bearer ${fixture.accessToken}` } },
    { DB: fixture.database, JWT_SECRET: secret },
  )
  const body = codeResponseSchema.safeParse(await response.json())

  return { status: response.status, code: body.success ? body.data.code : null }
}

async function exchangeCode(fixture: Fixture, code: string | null) {
  const response = await createApp(fixture, async () => {}).request(
    "/system/browser-sessions",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code ?? "code-was-not-issued" }),
    },
    { DB: fixture.database, JWT_SECRET: secret },
  )

  return response.status
}

async function countRows(database: D1Database, sql: string) {
  const row = await database.prepare(sql).first<{ total: number }>()

  return row?.total ?? 0
}

async function readState(database: D1Database) {
  return {
    codes: await countRows(database, "SELECT count(*) AS total FROM system_browser_login_codes"),
    sessions: await countRows(database, "SELECT count(*) AS total FROM system_sessions"),
    createdAudits: await countRows(
      database,
      "SELECT count(*) AS total FROM system_audit_events WHERE action = 'auth.browser_login_code.created'",
    ),
  }
}

async function noInterruption() {}

describe("System browser login code generation", () => {
  test("入口の認証の後にパスワードを再設定すると、コードを保存せず新しいセッションにも交換しない", async () => {
    const fixture = await createFixture()

    const created = await requestCode(fixture, async () => {
      const reset = await new SystemPasswordResetAdapter({
        env: { DB: fixture.database },
      }).reset({
        actorAccountId: adminAccountId,
        targetAccountId: accountId,
        passwordHash: "new-password-hash-value",
        now: fixture.clock.now,
        auditStatements: [],
      })
      expect(reset).toBe("reset")
    })
    const exchanged = await exchangeCode(fixture, created.code)

    expect({ created: created.status, exchanged, ...(await readState(fixture.database)) }).toEqual({
      created: 401,
      exchanged: 401,
      codes: 0,
      sessions: 1,
      createdAudits: 0,
    })
  })

  test("ログアウトで失効したセッションの認証からはコードを保存しない", async () => {
    const fixture = await createFixture()

    const created = await requestCode(fixture, async () => {
      await execSql(
        fixture.database,
        `UPDATE system_sessions SET revoked_at = ${fixture.clock.now.getTime()} WHERE account_id = '${accountId}'`,
      )
    })

    expect({ created: created.status, ...(await readState(fixture.database)) }).toEqual({
      created: 401,
      codes: 0,
      sessions: 1,
      createdAudits: 0,
    })
  })

  test("発行の時刻を取った後、それより後の時刻でログアウトが完了すると、コードを保存せず交換もできない", async () => {
    const fixture = await createFixture()

    const created = await requestCode(fixture, async () => {
      await execSql(
        fixture.database,
        `UPDATE system_sessions SET revoked_at = ${fixture.clock.now.getTime() + 1} WHERE account_id = '${accountId}'`,
      )
    })
    const exchanged = await exchangeCode(fixture, created.code)

    expect({ created: created.status, exchanged, ...(await readState(fixture.database)) }).toEqual({
      created: 401,
      exchanged: 401,
      codes: 0,
      sessions: 1,
      createdAudits: 0,
    })
  })

  test("通常のコードは60秒の期限で発行され、一度だけ新しいセッションに交換できる", async () => {
    const fixture = await createFixture()

    const created = await requestCode(fixture, noInterruption)
    const first = await exchangeCode(fixture, created.code)
    const second = await exchangeCode(fixture, created.code)

    expect(created.status).toBe(201)
    expect({ first, second, ...(await readState(fixture.database)) }).toEqual({
      first: 201,
      second: 401,
      codes: 0,
      sessions: 2,
      createdAudits: 1,
    })
  })

  test("60秒を過ぎたコードは交換できない", async () => {
    const fixture = await createFixture()

    const created = await requestCode(fixture, noInterruption)
    fixture.clock.now = new Date(fixture.clock.now.getTime() + 60_000)

    expect(created.status).toBe(201)
    expect(await exchangeCode(fixture, created.code)).toBe(401)
    expect(await countRows(fixture.database, "SELECT count(*) AS total FROM system_sessions")).toBe(
      1,
    )
  })

  test("停止したAccountのコードは交換できない", async () => {
    const fixture = await createFixture()

    const created = await requestCode(fixture, noInterruption)
    await execSql(
      fixture.database,
      `UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1 WHERE id = '${accountId}'`,
    )

    expect(created.status).toBe(201)
    expect(await exchangeCode(fixture, created.code)).toBe(401)
    expect(await countRows(fixture.database, "SELECT count(*) AS total FROM system_sessions")).toBe(
      1,
    )
  })
})
