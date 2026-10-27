import { CreateSystemBrowserLoginCode } from "@system/application/auth/create-system-browser-login-code"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.browser-sessions"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = "5b0f5d8e-3c1a-4f7e-9d2b-6a1c8e4f2d30"
const familyId = "8e2c4a6f-1b3d-4e5f-a7c9-0d2e4f6a8b1c"
const sessionId = "2f4a6c8e-0b1d-4f3e-8a5c-7e9b1d3f5a7c"

async function createFixture() {
  const database = await createLocalD1Database()
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('${accountId}', 'active', 0, 1, 1);
     INSERT INTO system_sessions
       (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
     VALUES ('${sessionId}', '${accountId}', '${familyId}', '${"c".repeat(64)}', 0, 1, ${now.getTime() + 86_400_000});`,
  )
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/browser-sessions", ...POST)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, { DB: database, JWT_SECRET: "browser-session-route-jwt-secret" }),
  })

  async function tryIssueCode(sessionFamilyId: string | null): Promise<string | null> {
    const creation = await new CreateSystemBrowserLoginCode({
      env: { DB: database },
      var: { now: () => now },
    }).execute({
      authentication: {
        accountId: zAccountId.parse(accountId),
        tokenVersion: 0,
        issuedAtMs: now.getTime(),
        expiresAtMs: now.getTime() + 60_000,
        machineCredentialId: null,
        identityBindingId: null,
        sessionFamilyId,
      },
      sessionFamilyId,
    })
    if (creation instanceof Error) throw creation
    return creation === null ? null : creation.code
  }

  async function issueCode(sessionFamilyId: string | null): Promise<string> {
    const code = await tryIssueCode(sessionFamilyId)
    if (code === null) throw new Error("browser login code was rejected")
    return code
  }

  async function countSessions(): Promise<number> {
    const row = await database
      .prepare("SELECT count(*) AS count FROM system_sessions")
      .first<{ count: number }>()
    return row?.count ?? -1
  }

  return Object.freeze({ client, database, issueCode, tryIssueCode, countSessions })
}

describe("POST /system/browser-sessions", () => {
  test("発行元credentialが有効なままならcodeをSessionへ交換する", async () => {
    const { client, issueCode, countSessions } = await createFixture()
    const unbound = await issueCode(null)
    const familyBound = await issueCode(familyId)

    const first = await client.system["browser-sessions"].$post({ json: { code: unbound } })
    const second = await client.system["browser-sessions"].$post({ json: { code: familyBound } })

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(await countSessions()).toBe(3)
  })

  test("token versionの更新後は失効前に発行したcodeを拒否する", async () => {
    const { client, database, issueCode, countSessions } = await createFixture()
    const code = await issueCode(familyId)
    await execSql(
      database,
      `UPDATE system_accounts SET token_version = token_version + 1, updated_at = updated_at + 1
       WHERE id = '${accountId}';`,
    )

    const response = await client.system["browser-sessions"].$post({ json: { code } })

    expect(Number(response.status)).toBe(401)
    expect(await countSessions()).toBe(1)
    expect(
      await database
        .prepare("SELECT count(*) AS count FROM system_browser_login_codes")
        .first<{ count: number }>(),
    ).toEqual({ count: 0 })
  })

  test("発行元Session familyの失効後はcodeを拒否する", async () => {
    const { client, database, issueCode, countSessions } = await createFixture()
    const code = await issueCode(familyId)
    await execSql(
      database,
      `UPDATE system_sessions SET revoked_at = ${now.getTime() - 1} WHERE family_id = '${familyId}';`,
    )

    const response = await client.system["browser-sessions"].$post({ json: { code } })

    expect(Number(response.status)).toBe(401)
    expect(await countSessions()).toBe(1)
  })

  test("存在しないSession familyへ束縛したcodeを拒否する", async () => {
    const { client, database, tryIssueCode, countSessions } = await createFixture()
    const missingFamilyId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
    // 発行の時点で発行元を照合するので、存在しないfamilyからはcodeを発行しない。
    expect(await tryIssueCode(missingFamilyId)).toBeNull()
    // 発行の照合を経ずに保存されたcodeも、交換の時点でfamilyを照合して拒否する。
    const code = crypto.randomUUID()
    const codeHash = await systemLoginCodeHash(code)
    if (codeHash instanceof Error) throw codeHash
    await database
      .prepare(
        `INSERT INTO system_browser_login_codes
           (code_hash, account_id, token_version, session_family_id, created_at, expires_at)
         VALUES (?1, ?2, 0, ?3, ?4, ?5)`,
      )
      .bind(codeHash, accountId, missingFamilyId, now.getTime(), now.getTime() + 60_000)
      .run()

    const response = await client.system["browser-sessions"].$post({ json: { code } })

    expect(Number(response.status)).toBe(401)
    expect(await countSessions()).toBe(1)
  })
})
