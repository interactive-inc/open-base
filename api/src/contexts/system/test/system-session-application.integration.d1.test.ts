import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import type {
  SystemAccessTokenIssuer,
  SystemSessionMaterial,
} from "@system/domain/definitions/auth/system-session-issuance.definition"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import { zSessionId } from "@system/domain/schemas/auth/session-id.schema"
import { zSessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { testLiteralId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const firstSessionId = testLiteralId("session-1")
const secondSessionId = testLiteralId("session-2")
const firstSessionFamilyId = testLiteralId("family-1")

const accountId = zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e")
const now = new Date("2026-01-01T00:00:00.000Z")
const rotateAt = new Date("2026-01-02T00:00:00.000Z")
const sessionTtlMilliseconds = 7 * 24 * 60 * 60 * 1_000
const sessionMaxLifetimeMilliseconds = 30 * 24 * 60 * 60 * 1_000
const firstRawToken = "raw-token-1"
const secondRawToken = "raw-token-2"
const thirdRawToken = "raw-token-3"
const firstTokenHash = "a".repeat(64)
const secondTokenHash = "b".repeat(64)
const thirdTokenHash = "c".repeat(64)
const auditContext = Object.freeze({
  authorizationJson: '{"permission":"auth:session"}',
  metadataJson: '{"client":"test"}',
})
const accessTokenIssuer: SystemAccessTokenIssuer = Object.freeze({
  issue: async (input) => `access-token-${input.tokenVersion}-${input.now.toISOString()}`,
})

type MaterialProps = Readonly<{
  rawTokens: ReadonlyArray<string>
  tokenHashes: Readonly<Record<string, string>>
}>

function createMaterialService(props: MaterialProps): SystemSessionMaterial {
  let sessionSequence = 0
  let familySequence = 0
  let rawTokenSequence = 0

  return {
    generateSessionId: () => zSessionId.parse(testLiteralId(`session-${++sessionSequence}`)),
    generateFamilyId: () => zSessionFamilyId.parse(testLiteralId(`family-${++familySequence}`)),
    generateRawToken: () =>
      props.rawTokens.at(rawTokenSequence++) ?? new Error("raw token exhausted"),
    hashRawToken: async (rawToken) => {
      const tokenHash = props.tokenHashes[rawToken]

      return tokenHash === undefined
        ? new Error("unknown raw token")
        : zSessionTokenHash.parse(tokenHash)
    },
  }
}

async function insertAccount(
  fixture: SystemSessionTestContext,
  status: "active" | "suspended" | "locked" = "active",
  tokenVersion = 0,
): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_accounts
         (id, status, token_version, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?4)`)
    .bind(accountId, status, tokenVersion, now.getTime())
    .run()
}

function createIssueSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
  ttlMilliseconds = sessionTtlMilliseconds,
  maxLifetimeMilliseconds = sessionMaxLifetimeMilliseconds,
): IssueSystemSession {
  return new IssueSystemSession({
    accountRepository: new SystemAccountRepository({ database: fixture.context.env.DB }),
    sessionRepository: new SystemSessionRepository({ context: fixture.context }),
    materialService,
    accessTokenIssuer,
    sessionTtlMilliseconds: ttlMilliseconds,
    sessionMaxLifetimeMilliseconds: maxLifetimeMilliseconds,
  })
}

function createRotateSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
  ttlMilliseconds = sessionTtlMilliseconds,
  maxLifetimeMilliseconds = sessionMaxLifetimeMilliseconds,
): RotateSystemSession {
  return new RotateSystemSession({
    accountRepository: new SystemAccountRepository({ database: fixture.context.env.DB }),
    sessionRepository: new SystemSessionRepository({ context: fixture.context }),
    auditAppender: new SystemAuditEventRepository(fixture.context),
    materialService,
    accessTokenIssuer,
    sessionTtlMilliseconds: ttlMilliseconds,
    sessionMaxLifetimeMilliseconds: maxLifetimeMilliseconds,
  })
}

function createAuthenticateSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
) {
  const repository = new SystemSessionRepository({ context: fixture.context })
  return {
    execute: (command: Parameters<typeof repository.authenticate>[0]) =>
      repository.authenticate(command, materialService),
  }
}

function createRevokeSystemSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
): RevokeSystemSession {
  return new RevokeSystemSession({
    sessionRepository: new SystemSessionRepository({ context: fixture.context }),
    materialService,
  })
}

async function issueInitialSession(
  fixture: SystemSessionTestContext,
  materialService: SystemSessionMaterial,
  ttlMilliseconds = sessionTtlMilliseconds,
): Promise<void> {
  const result = await createIssueSystemSession(fixture, materialService, ttlMilliseconds).execute({
    accountId,
    tokenVersion: 0,
    now,
    auditContext,
  })

  if (result instanceof Error || result.kind !== "issued") {
    throw new Error("initial System Session was not issued", { cause: result })
  }
}

async function sessionRows(
  fixture: SystemSessionTestContext,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  return (
    await fixture.database
      .prepare(`SELECT id, account_id, family_id, token_hash, token_version,
              created_at, expires_at, rotated_at, revoked_at
       FROM system_sessions ORDER BY created_at, id`)
      .all<Record<string, unknown>>()
  ).results
}

async function auditRows(
  fixture: SystemSessionTestContext,
): Promise<ReadonlyArray<Record<string, unknown>>> {
  return (
    await fixture.database
      .prepare(`SELECT actor_account_id, action, target_type, target_id, outcome, reason_code,
              authorization_json, metadata_json, occurred_at
       FROM system_audit_events ORDER BY occurred_at, rowid`)
      .all<Record<string, unknown>>()
  ).results
}

/** SystemのApplication API compositionと永続化adapterを共通fixtureで横断検証する。 */
describe("IssueSystemSession", () => {
  test("active Accountのcanonical versionでraw tokenを保存せずSessionと監査を発行する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken],
      tokenHashes: { [firstRawToken]: firstTokenHash },
    })

    const result = await createIssueSystemSession(fixture, materialService).execute({
      accountId,
      tokenVersion: 0,
      now,
      auditContext,
    })

    expect(result).toEqual({
      kind: "issued",
      accountId,
      tokenVersion: 0,
      accessToken: "access-token-0-2026-01-01T00:00:00.000Z",
      rawToken: firstRawToken,
      sessionId: zSessionId.parse(firstSessionId),
      expiresAt: new Date(now.getTime() + sessionTtlMilliseconds),
    })
    expect(await sessionRows(fixture)).toEqual([
      {
        id: firstSessionId,
        account_id: accountId,
        family_id: firstSessionFamilyId,
        token_hash: firstTokenHash,
        token_version: 0,
        created_at: now.getTime(),
        expires_at: now.getTime() + sessionTtlMilliseconds,
        rotated_at: null,
        revoked_at: null,
      },
    ])
    expect(
      JSON.stringify([...(await sessionRows(fixture)), ...(await auditRows(fixture))]),
    ).not.toContain(firstRawToken)
    expect(await auditRows(fixture)).toEqual([
      {
        actor_account_id: accountId,
        action: "auth.session.create",
        target_type: "session",
        target_id: firstSessionId,
        outcome: "succeeded",
        reason_code: null,
        authorization_json: auditContext.authorizationJson,
        metadata_json: auditContext.metadataJson,
        occurred_at: now.getTime(),
      },
    ])
  })

  test.each([
    ["suspended", 0, 0, "account_inactive"],
    ["locked", 0, 0, "account_inactive"],
    ["active", 1, 0, "token_version_mismatch"],
  ] as const)(
    "Account状態またはversion driftをfail closedにしてtokenを生成しない",
    async (status, accountTokenVersion, requestedTokenVersion, reason) => {
      const fixture = await SystemSessionTestContext.create()
      await insertAccount(fixture, status, accountTokenVersion)
      const materialService = createMaterialService({ rawTokens: [], tokenHashes: {} })

      expect(
        await createIssueSystemSession(fixture, materialService).execute({
          accountId,
          tokenVersion: requestedTokenVersion,
          now,
          auditContext,
        }),
      ).toEqual({ kind: "rejected", reason })
      expect(await sessionRows(fixture)).toEqual([])
      expect(await auditRows(fixture)).toEqual([])
    },
  )
})

describe("RotateSystemSession", () => {
  test("active Sessionをrotationし、使用済みtokenの再利用でfamily全体を失効する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    const rotate = createRotateSystemSession(fixture, materialService)

    expect(await rotate.execute({ rawToken: firstRawToken, now: rotateAt, auditContext })).toEqual({
      kind: "rotated",
      accountId,
      tokenVersion: 0,
      accessToken: "access-token-0-2026-01-02T00:00:00.000Z",
      rawToken: secondRawToken,
      sessionId: zSessionId.parse(secondSessionId),
      expiresAt: new Date(rotateAt.getTime() + sessionTtlMilliseconds),
    })
    expect(
      await rotate.execute({
        rawToken: firstRawToken,
        now: new Date(rotateAt.getTime() + 1),
        auditContext,
      }),
    ).toEqual({ kind: "rejected", reason: "reused" })

    expect(await sessionRows(fixture)).toEqual([
      expect.objectContaining({
        id: firstSessionId,
        rotated_at: rotateAt.getTime(),
        revoked_at: rotateAt.getTime() + 1,
      }),
      expect.objectContaining({
        id: secondSessionId,
        token_hash: secondTokenHash,
        rotated_at: null,
        revoked_at: rotateAt.getTime() + 1,
      }),
    ])
    expect((await auditRows(fixture)).map((row) => [row.outcome, row.reason_code])).toEqual([
      ["succeeded", null],
      ["succeeded", null],
      ["denied", "refresh_token_reused"],
    ])
  })

  test("同じactive tokenの並行rotationは一方だけ成功し、後発をreuseとしてfamily失効する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken, thirdRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
        [thirdRawToken]: thirdTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    const rotate = createRotateSystemSession(fixture, materialService)
    const results = await Promise.all([
      rotate.execute({ rawToken: firstRawToken, now: rotateAt, auditContext }),
      rotate.execute({ rawToken: firstRawToken, now: rotateAt, auditContext }),
    ])

    expect(
      results.map((result) => (result instanceof Error ? result.name : result.kind)).sort(),
    ).toEqual(["rejected", "rotated"])
    expect(
      results.find((result) => !(result instanceof Error) && result.kind === "rejected"),
    ).toEqual({ kind: "rejected", reason: "reused" })
    expect((await sessionRows(fixture)).every((row) => row.revoked_at === rotateAt.getTime())).toBe(
      true,
    )
  })

  test("期限切れとAccount停止をinvalidとしてfamily失効しsuccessorを返さない", async () => {
    for (const scenario of ["expired", "locked"] as const) {
      const fixture = await SystemSessionTestContext.create()
      await insertAccount(fixture)
      const materialService = createMaterialService({
        rawTokens: [firstRawToken],
        tokenHashes: { [firstRawToken]: firstTokenHash },
      })
      await issueInitialSession(
        fixture,
        materialService,
        scenario === "expired" ? 1 : sessionTtlMilliseconds,
      )

      if (scenario === "locked") {
        await fixture.database
          .prepare(`UPDATE system_accounts
           SET status = 'locked', token_version = 1, updated_at = ?1
           WHERE id = ?2`)
          .bind(rotateAt.getTime(), accountId)
          .run()
      }

      expect(
        await createRotateSystemSession(fixture, materialService).execute({
          rawToken: firstRawToken,
          now: rotateAt,
          auditContext,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid" })
      expect(await sessionRows(fixture)).toHaveLength(1)
      expect((await sessionRows(fixture))[0]?.revoked_at).toBe(rotateAt.getTime())
      expect((await auditRows(fixture)).at(-1)).toEqual(
        expect.objectContaining({ outcome: "denied", reason_code: "session_invalid" }),
      )
    }
  })

  test("未知tokenは主体・対象を推測せず拒否監査をappendする", async () => {
    const fixture = await SystemSessionTestContext.create()
    const materialService = createMaterialService({
      rawTokens: [],
      tokenHashes: { unknown: firstTokenHash },
    })

    expect(
      await createRotateSystemSession(fixture, materialService).execute({
        rawToken: "unknown",
        now: rotateAt,
        auditContext,
      }),
    ).toEqual({ kind: "rejected", reason: "invalid" })
    expect(await auditRows(fixture)).toEqual([
      {
        actor_account_id: null,
        action: "auth.session.rotate",
        target_type: "session",
        target_id: null,
        outcome: "denied",
        reason_code: "session_invalid",
        authorization_json: auditContext.authorizationJson,
        metadata_json: auditContext.metadataJson,
        occurred_at: rotateAt.getTime(),
      },
    ])
  })

  test("未知tokenの拒否監査を保存できない場合は認証拒否成功に丸めない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await execSql(
      fixture.database,
      `
      CREATE TRIGGER ignore_system_session_application_audit
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `,
    )
    const materialService = createMaterialService({
      rawTokens: [],
      tokenHashes: { unknown: firstTokenHash },
    })

    expect(
      await createRotateSystemSession(fixture, materialService).execute({
        rawToken: "unknown",
        now: rotateAt,
        auditContext,
      }),
    ).toBeInstanceOf(Error)
    expect(await auditRows(fixture)).toEqual([])
  })
})

describe("AuthenticateSystemSession", () => {
  test("active Sessionをcanonical Accountと同じidentity・versionで認証する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken],
      tokenHashes: { [firstRawToken]: firstTokenHash },
    })
    await issueInitialSession(fixture, materialService)

    expect(
      await createAuthenticateSystemSession(fixture, materialService).execute({
        rawToken: firstRawToken,
        now,
      }),
    ).toEqual({
      kind: "authenticated",
      accountId,
      tokenVersion: 0,
      sessionId: zSessionId.parse(firstSessionId),
      expiresAt: new Date(now.getTime() + sessionTtlMilliseconds),
    })
  })

  test("未知・期限切れ・rotation済みtokenを同じinvalidへ畳む", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
        unknown: thirdTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    const authenticate = createAuthenticateSystemSession(fixture, materialService)

    expect(await authenticate.execute({ rawToken: "unknown", now })).toEqual({
      kind: "rejected",
      reason: "invalid",
    })
    expect(
      await authenticate.execute({
        rawToken: firstRawToken,
        now: new Date(now.getTime() + sessionTtlMilliseconds),
      }),
    ).toEqual({ kind: "rejected", reason: "invalid" })

    expect(
      await createRotateSystemSession(fixture, materialService).execute({
        rawToken: firstRawToken,
        now: rotateAt,
        auditContext,
      }),
    ).toEqual(
      expect.objectContaining({
        kind: "rotated",
        rawToken: secondRawToken,
      }),
    )
    expect(await authenticate.execute({ rawToken: firstRawToken, now: rotateAt })).toEqual({
      kind: "rejected",
      reason: "invalid",
    })
    expect(await authenticate.execute({ rawToken: secondRawToken, now: rotateAt })).toEqual(
      expect.objectContaining({ kind: "authenticated", accountId, tokenVersion: 0 }),
    )
  })

  test("canonical Account停止とversion driftを同じinvalidへ畳む", async () => {
    for (const scenario of ["locked", "version_drift"] as const) {
      const fixture = await SystemSessionTestContext.create()
      await insertAccount(fixture)
      const materialService = createMaterialService({
        rawTokens: [firstRawToken],
        tokenHashes: { [firstRawToken]: firstTokenHash },
      })
      await issueInitialSession(fixture, materialService)
      await fixture.database
        .prepare(`UPDATE system_accounts
         SET status = ?1, token_version = ?2, updated_at = ?3
         WHERE id = ?4`)
        .bind(scenario === "locked" ? "locked" : "active", 1, rotateAt.getTime(), accountId)
        .run()

      expect(
        await createAuthenticateSystemSession(fixture, materialService).execute({
          rawToken: firstRawToken,
          now: rotateAt,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid" })
    }
  })
})

describe("RevokeSystemSession", () => {
  test("既知tokenのfamilyを監査と同時に冪等失効する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken, secondRawToken],
      tokenHashes: {
        [firstRawToken]: firstTokenHash,
        [secondRawToken]: secondTokenHash,
      },
    })
    await issueInitialSession(fixture, materialService)
    await createRotateSystemSession(fixture, materialService).execute({
      rawToken: firstRawToken,
      now: rotateAt,
      auditContext,
    })
    const revoke = createRevokeSystemSession(fixture, materialService)
    const revokedAt = new Date(rotateAt.getTime() + 1)

    expect(
      await revoke.execute({ rawToken: secondRawToken, now: revokedAt, auditContext }),
    ).toEqual({ kind: "completed" })
    expect(
      (await sessionRows(fixture)).every((row) => row.revoked_at === revokedAt.getTime()),
    ).toBe(true)
    expect((await auditRows(fixture)).at(-1)).toEqual(
      expect.objectContaining({
        action: "auth.session.revoke",
        outcome: "succeeded",
        target_id: secondSessionId,
      }),
    )
    const auditCount = (await auditRows(fixture)).length

    expect(
      await revoke.execute({ rawToken: secondRawToken, now: revokedAt, auditContext }),
    ).toEqual({ kind: "completed" })
    expect(await auditRows(fixture)).toHaveLength(auditCount)
    expect(
      await createAuthenticateSystemSession(fixture, materialService).execute({
        rawToken: secondRawToken,
        now: revokedAt,
      }),
    ).toEqual({ kind: "rejected", reason: "invalid" })
  })

  test("未知tokenを実在するtokenと区別できない完了へ畳む", async () => {
    const fixture = await SystemSessionTestContext.create()
    const materialService = createMaterialService({
      rawTokens: [],
      tokenHashes: { unknown: thirdTokenHash },
    })

    expect(
      await createRevokeSystemSession(fixture, materialService).execute({
        rawToken: "unknown",
        now,
        auditContext,
      }),
    ).toEqual({ kind: "completed" })
    expect(await auditRows(fixture)).toEqual([])
  })

  test("失効監査を保存できない場合はfamily mutationもrollbackする", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const materialService = createMaterialService({
      rawTokens: [firstRawToken],
      tokenHashes: { [firstRawToken]: firstTokenHash },
    })
    await issueInitialSession(fixture, materialService)
    await execSql(
      fixture.database,
      `
      CREATE TRIGGER ignore_system_session_revocation_audit
      BEFORE INSERT ON system_audit_events
      WHEN NEW.action = 'auth.session.revoke'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `,
    )

    expect(
      await createRevokeSystemSession(fixture, materialService).execute({
        rawToken: firstRawToken,
        now: rotateAt,
        auditContext,
      }),
    ).toBeInstanceOf(Error)
    expect((await sessionRows(fixture))[0]?.revoked_at).toBeNull()
    expect((await auditRows(fixture)).map((row) => row.action)).toEqual(["auth.session.create"])
  })
})

describe("SystemSessionMaterialService", () => {
  test("256-bit raw token・opaque ID・SHA-256 hashだけを生成する", async () => {
    const service = new SystemSessionMaterialService()
    const rawToken = service.generateRawToken()

    expect(typeof rawToken).toBe("string")
    if (rawToken instanceof Error) throw rawToken
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/)
    expect(service.generateSessionId()).not.toBeInstanceOf(Error)
    expect(service.generateFamilyId()).not.toBeInstanceOf(Error)
    expect(await service.hashRawToken("abc")).toBe(
      zSessionTokenHash.parse("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
    )
  })
})
