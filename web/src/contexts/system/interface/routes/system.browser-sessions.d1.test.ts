import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { zSessionId } from "@system/domain/schemas/auth/session-id.schema"
import { zSessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { CreateSystemBrowserLoginCode } from "@system/application/auth/create-system-browser-login-code"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { systemBrowserLoginCodeHash } from "@system/lib/auth/system-browser-login-code-hash"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.browser-sessions"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = "5b0f5d8e-3c1a-4f7e-9d2b-6a1c8e4f2d30"
const familyId = "8e2c4a6f-1b3d-4e5f-a7c9-0d2e4f6a8b1c"
const sessionId = "2f4a6c8e-0b1d-4f3e-8a5c-7e9b1d3f5a7c"

async function createFixture(
  options: {
    tokenHash?: string
    authenticatedAt?: number
    createdAt?: number
    maxLifetimeSeconds?: number
    ttlSeconds?: number
  } = {},
) {
  const database = await createLocalD1Database()
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
     VALUES ('${accountId}', 'active', 0, 1, 1);
     INSERT INTO system_sessions
       (id, account_id, family_id, token_hash, token_version, created_at, expires_at, authenticated_at)
     VALUES ('${sessionId}', '${accountId}', '${familyId}', '${options.tokenHash ?? "c".repeat(64)}', 0, ${options.createdAt ?? now.getTime() - 1000}, ${now.getTime() + 86_400_000}, ${options.authenticatedAt ?? "NULL"});`,
  )
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .post("/system/browser-sessions", ...POST)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: database,
        JWT_SECRET: "browser-session-route-jwt-secret",
        SYSTEM_SESSION_TTL_SECONDS: String(options.ttlSeconds ?? 604800),
        SYSTEM_SESSION_MAX_LIFETIME_SECONDS: String(options.maxLifetimeSeconds ?? 2592000),
      }),
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
    const familyBound = await issueCode(familyId)

    const second = await client.system["browser-sessions"].$post({ json: { code: familyBound } })

    expect(second.status).toBe(201)
    expect(await countSessions()).toBe(2)
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
    const codeHash = await systemBrowserLoginCodeHash(code)
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

test("同じfamilyと認証時刻を引き継ぎ、更新してもSessionとaccess tokenの絶対寿命を延ばさない", async () => {
  const maxLifetime = 3 * 86400000
  const authenticatedAt = now.getTime() - maxLifetime + 10000
  const f = await createFixture({ authenticatedAt, maxLifetimeSeconds: maxLifetime / 1000 })
  const code = await f.issueCode(familyId)
  const response = await f.client.system["browser-sessions"].$post({ json: { code } })
  expect(response.status).toBe(201)
  const body = await response.json()
  expect(
    await f.database
      .prepare("SELECT family_id, authenticated_at, expires_at FROM system_sessions WHERE id = ?1")
      .bind(body.session_id)
      .first<{ family_id: string; authenticated_at: number; expires_at: number }>(),
  ).toEqual({
    family_id: familyId,
    authenticated_at: authenticatedAt,
    expires_at: now.getTime() + 10000,
  })
  const verifier = new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE })
  expect(
    await verifier.verify(body.access_token, "browser-session-route-jwt-secret", now),
  ).toMatchObject({ sid: familyId, exp: now.getTime() / 1000 + 10 })
  const applications = createSystemSessionApplications({
    context: { env: { DB: f.database } },
    jwtSecret: "browser-session-route-jwt-secret",
    sessionTtlMilliseconds: 604800000,
    sessionMaxLifetimeMilliseconds: maxLifetime,
  })
  if (applications instanceof Error) throw applications
  const rotated = await applications.rotate.execute({
    rawToken: body.refresh_token,
    now: new Date(now.getTime() + 9000),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (rotated instanceof Error || rotated.kind !== "rotated")
    throw rotated instanceof Error
      ? rotated
      : new Error(`rotation rejected: ${JSON.stringify(rotated)}`)
  expect(rotated.expiresAt.getTime()).toBe(now.getTime() + 10000)
  expect(
    await verifier.verify(
      rotated.accessToken,
      "browser-session-route-jwt-secret",
      new Date(now.getTime() + 9000),
    ),
  ).toMatchObject({ sid: familyId, exp: now.getTime() / 1000 + 10 })
  expect(
    await verifier.verify(
      rotated.accessToken,
      "browser-session-route-jwt-secret",
      new Date(now.getTime() + 10000),
    ),
  ).toBeInstanceOf(Error)
  expect(
    await applications.rotate.execute({
      rawToken: rotated.rawToken,
      now: new Date(now.getTime() + 10000),
      auditContext: { authorizationJson: null, metadataJson: null },
    }),
  ).toMatchObject({ kind: "rejected" })
  expect(await f.countSessions()).toBe(3)
})

test("familyのない認証はコードを発行せず、旧方式のコードも交換しない", async () => {
  const f = await createFixture()
  expect(await f.tryIssueCode(null)).toBeNull()
  const code = crypto.randomUUID()
  const hash = await systemLoginCodeHash(code)
  if (hash instanceof Error) throw hash
  await f.database
    .prepare(`INSERT INTO system_browser_login_codes VALUES (?1, ?2, 0, ?3, ?4, ?5)`)
    .bind(hash, accountId, familyId, now.getTime(), now.getTime() + 60000)
    .run()
  const response = await f.client.system["browser-sessions"].$post({ json: { code } })
  expect(Number(response.status)).toBe(401)
  expect(await f.countSessions()).toBe(1)
})

test("発行元のログアウトは交換済みのブラウザの認証と更新にも反映する", async () => {
  const f = await createFixture()
  const response = await f.client.system["browser-sessions"].$post({
    json: { code: await f.issueCode(familyId) },
  })
  expect(response.status).toBe(201)
  const body = await response.json()
  const authentication = new SystemAccessTokenStateAdapter({ database: f.database })
  const proof = {
    accountId: zAccountId.parse(accountId),
    tokenVersion: 0,
    issuedAtMs: now.getTime(),
    sessionFamilyId: familyId,
    at: now,
  }
  expect(await authentication.resolve(proof)).toMatchObject({ kind: "accepted" })
  const applications = createSystemSessionApplications({
    context: { env: { DB: f.database } },
    jwtSecret: "browser-session-route-jwt-secret",
    sessionTtlMilliseconds: 604800000,
  })
  if (applications instanceof Error) throw applications
  expect(
    await applications.authenticate.execute({ rawToken: body.refresh_token, now }),
  ).toMatchObject({ kind: "authenticated" })
  const revoked = await applications.revoke.execute({
    rawToken: body.refresh_token,
    now,
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (revoked instanceof Error) throw revoked
  expect(await authentication.resolve(proof)).toMatchObject({ kind: "rejected" })
  expect(
    await applications.authenticate.execute({ rawToken: body.refresh_token, now }),
  ).toMatchObject({ kind: "rejected" })
  expect(
    (
      await f.database
        .prepare("SELECT revoked_at FROM system_sessions WHERE family_id = ?1")
        .bind(familyId)
        .all()
    ).results,
  ).toEqual([{ revoked_at: now.getTime() }, { revoked_at: now.getTime() }])
})

test("旧方式で独立して作ったブラウザのfamilyは認証・更新・再交換に使わない", async () => {
  const f = await createFixture()
  const code = await f.issueCode(familyId)
  const authentication = new SystemAccessTokenStateAdapter({ database: f.database })
  const proof = {
    accountId: zAccountId.parse(accountId),
    tokenVersion: 0,
    issuedAtMs: now.getTime(),
    sessionFamilyId: familyId,
    at: now,
  }
  expect(await authentication.resolve(proof)).toMatchObject({ kind: "accepted" })
  const audit = SystemAuditEventEntity.createSession({
    actorAccountId: zAccountId.parse(accountId),
    action: "auth.session.create",
    targetId: zSessionId.parse(sessionId),
    outcome: "succeeded",
    reasonCode: null,
    occurredAt: new Date(now.getTime() - 1000),
    context: {
      authorizationJson: null,
      metadataJson: JSON.stringify({ transport: "system.browser-sessions" }),
    },
  })
  if (audit instanceof Error) throw audit
  await f.database.batch([
    ...new SystemAuditEventRepository({ env: { DB: f.database } }).prepareAppend(audit),
  ])
  expect(await authentication.resolve(proof)).toMatchObject({ kind: "rejected" })
  expect(
    await new SystemSessionRepository({ context: { env: { DB: f.database } } }).find(
      zSessionTokenHash.parse("c".repeat(64)),
    ),
  ).toBeNull()
  expect(await f.tryIssueCode(familyId)).toBeNull()
  expect(Number((await f.client.system["browser-sessions"].$post({ json: { code } })).status)).toBe(
    401,
  )
  expect(await f.countSessions()).toBe(1)
})

test("保存直前に発行元が失効した場合は新しいSessionと成功の監査を残さない", async () => {
  const f = await createFixture()
  const code = await f.issueCode(familyId)
  const original = SystemSessionRepository.prototype.createWithAudit
  const save = spyOn(SystemSessionRepository.prototype, "createWithAudit").mockImplementation(
    async function (
      this: SystemSessionRepository,
      ...args: Parameters<SystemSessionRepository["createWithAudit"]>
    ) {
      await f.database
        .prepare("UPDATE system_sessions SET revoked_at = ?1 WHERE family_id = ?2")
        .bind(now.getTime(), familyId)
        .run()
      return original.apply(this, args)
    },
  )
  try {
    expect(
      Number((await f.client.system["browser-sessions"].$post({ json: { code } })).status),
    ).toBe(401)
    expect(save).toHaveBeenCalledTimes(1)
  } finally {
    save.mockRestore()
  }
  expect(await f.countSessions()).toBe(1)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM system_audit_events WHERE action = 'auth.session.create'",
      )
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
})

test("新しいSessionの監査が失敗した場合はSessionの追記も取り消す", async () => {
  const f = await createFixture()
  const code = await f.issueCode(familyId)
  await execSql(
    f.database,
    `CREATE TRIGGER reject_browser_session_audit BEFORE INSERT ON system_audit_events WHEN NEW.action = 'auth.session.create' BEGIN SELECT RAISE(IGNORE); END;`,
  )
  expect(Number((await f.client.system["browser-sessions"].$post({ json: { code } })).status)).toBe(
    503,
  )
  expect(await f.countSessions()).toBe(1)
})

test("正規に交換した二つのブラウザは別々に更新でき、使用済みtokenの再利用は全て失効する", async () => {
  const f = await createFixture()
  const applications = createSystemSessionApplications({
    context: { env: { DB: f.database } },
    jwtSecret: "browser-session-route-jwt-secret",
    sessionTtlMilliseconds: 604800000,
  })
  if (applications instanceof Error) throw applications
  const tokens: string[] = []
  for (let i = 0; i < 2; i++) {
    const response = await f.client.system["browser-sessions"].$post({
      json: { code: await f.issueCode(familyId) },
    })
    expect(response.status).toBe(201)
    tokens.push((await response.json()).refresh_token)
  }
  const successors: string[] = []
  for (const token of tokens) {
    const rotated = await applications.rotate.execute({
      rawToken: token,
      now: new Date(now.getTime() + 1000),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    expect(rotated).toMatchObject({ kind: "rotated" })
    if (rotated instanceof Error || rotated.kind !== "rotated") throw new Error("rotation failed")
    successors.push(rotated.rawToken)
  }
  expect(
    await applications.rotate.execute({
      rawToken: tokens[0]!,
      now: new Date(now.getTime() + 2000),
      auditContext: { authorizationJson: null, metadataJson: null },
    }),
  ).toMatchObject({ kind: "rejected", reason: "reused" })
  for (const token of successors)
    expect(
      await applications.authenticate.execute({
        rawToken: token,
        now: new Date(now.getTime() + 2000),
      }),
    ).toMatchObject({ kind: "rejected" })
  expect(
    await f.database
      .prepare("SELECT count(*) AS count FROM system_sessions WHERE revoked_at IS NULL")
      .first<{ count: number }>(),
  ).toEqual({ count: 0 })
})

test("コード消費後に発行元が正常更新されても、有効な後継があれば交換できる", async () => {
  const rawToken = "origin-session-token"
  const hash = await new SystemSessionMaterialService().hashRawToken(rawToken)
  if (hash instanceof Error) throw hash
  const f = await createFixture({ tokenHash: hash })
  const code = await f.issueCode(familyId)
  const applications = createSystemSessionApplications({
    context: { env: { DB: f.database } },
    jwtSecret: "browser-session-route-jwt-secret",
    sessionTtlMilliseconds: 604800000,
  })
  if (applications instanceof Error) throw applications
  const original = SystemSessionRepository.prototype.createWithAudit
  const save = spyOn(SystemSessionRepository.prototype, "createWithAudit").mockImplementation(
    async function (
      this: SystemSessionRepository,
      ...args: Parameters<SystemSessionRepository["createWithAudit"]>
    ) {
      expect(
        await applications.rotate.execute({
          rawToken,
          now: new Date(now.getTime() + 1),
          auditContext: { authorizationJson: null, metadataJson: null },
        }),
      ).toMatchObject({ kind: "rotated" })
      return original.apply(this, args)
    },
  )
  try {
    expect((await f.client.system["browser-sessions"].$post({ json: { code } })).status).toBe(201)
    expect(save).toHaveBeenCalledTimes(1)
  } finally {
    save.mockRestore()
  }
  expect(await f.countSessions()).toBe(3)
})

test("交換要求の開始直後に更新された後継も、消費時に有効な発行元として扱う", async () => {
  const rawToken = "origin-before-consumption"
  const hash = await new SystemSessionMaterialService().hashRawToken(rawToken)
  if (hash instanceof Error) throw hash
  const f = await createFixture({ tokenHash: hash })
  const code = await f.issueCode(familyId)
  const applications = createSystemSessionApplications({
    context: { env: { DB: f.database } },
    jwtSecret: "browser-session-route-jwt-secret",
    sessionTtlMilliseconds: 604800000,
  })
  if (applications instanceof Error) throw applications
  expect(
    await applications.rotate.execute({
      rawToken,
      now: new Date(now.getTime() + 1),
      auditContext: { authorizationJson: null, metadataJson: null },
    }),
  ).toMatchObject({ kind: "rotated" })
  expect((await f.client.system["browser-sessions"].$post({ json: { code } })).status).toBe(201)
  expect(await f.countSessions()).toBe(3)
})
