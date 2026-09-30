import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testLiteralId, testSerialId } from "@/contexts/system/test/system-test-id.test-support"
import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import { SessionEntity } from "@system/domain/entities/session.entity"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const createdAt = new Date("2026-01-01T00:00:00.000Z")
const rotatedAt = new Date("2026-01-02T00:00:00.000Z")
const expiresAt = new Date("2026-01-08T00:00:00.000Z")
const successorExpiresAt = new Date("2026-01-09T00:00:00.000Z")
const accountId = "d5858208-e680-4db8-a05d-8bf4f900c24e"
const familyId = testLiteralId("family-1")
/** ORDER BY id の期待順を保つため、連番から UUID を作る。 */
const SESSION_ID_1 = testSerialId("01900062", 1)
const SESSION_ID_2 = testSerialId("01900062", 2)
const tokenHash = "a".repeat(64)
const successorTokenHash = "b".repeat(64)

function createSession(props: {
  id: string
  tokenHash: string
  createdAt: Date
  expiresAt: Date
}): SessionEntity {
  const session = SessionEntity.create({
    id: props.id,
    accountId,
    familyId,
    tokenHash: props.tokenHash,
    tokenVersion: 0,
    authenticatedAt: createdAt,
    createdAt: props.createdAt,
    expiresAt: props.expiresAt,
    rotatedAt: null,
    revokedAt: null,
  })

  if (session instanceof Error) throw session

  return session
}

function createAudit(props: {
  action: string
  targetId: string
  outcome: "succeeded" | "denied"
  reasonCode: string | null
  occurredAt: Date
}): SystemAuditEventEntity {
  const audit = SystemAuditEventEntity.create({
    actorAccountId: accountId,
    action: props.action,
    targetType: "session",
    targetId: props.targetId,
    outcome: props.outcome,
    reasonCode: props.reasonCode,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: props.occurredAt,
  })

  if (audit instanceof Error) throw audit

  return audit
}

function createRotation(): SessionRotationValue {
  const previous = createSession({
    id: SESSION_ID_1,
    tokenHash,
    createdAt,
    expiresAt,
  })
  const successor = createSession({
    id: SESSION_ID_2,
    tokenHash: successorTokenHash,
    createdAt: rotatedAt,
    expiresAt: successorExpiresAt,
  })
  const rotation = SessionRotationValue.create(previous, successor, rotatedAt)

  if (rotation instanceof Error) throw rotation

  return rotation
}

function createRotationAudits(rotation: SessionRotationValue): SessionRotationAuditEvents {
  const occurredAt = rotation.previous.rotatedAt

  if (occurredAt === null) throw new Error("rotation time is missing")

  return {
    rotated: createAudit({
      action: "auth.session.rotate",
      targetId: rotation.previous.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt,
    }),
    reused: createAudit({
      action: "auth.session.rotate",
      targetId: rotation.previous.id,
      outcome: "denied",
      reasonCode: "refresh_token_reused",
      occurredAt,
    }),
    invalid: createAudit({
      action: "auth.session.rotate",
      targetId: rotation.previous.id,
      outcome: "denied",
      reasonCode: "session_invalid",
      occurredAt,
    }),
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
    .bind(accountId, status, tokenVersion, createdAt.getTime())
    .run()
}

async function insertSession(
  fixture: SystemSessionTestContext,
  session: SessionEntity,
): Promise<void> {
  await fixture.database
    .prepare(`INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version,
          created_at, expires_at, rotated_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`)
    .bind(
      session.id,
      session.accountId,
      session.familyId,
      session.tokenHash,
      session.tokenVersion,
      session.createdAt.getTime(),
      session.expiresAt.getTime(),
      session.rotatedAt?.getTime() ?? null,
      session.revokedAt?.getTime() ?? null,
    )
    .run()
}

async function getCount(fixture: SystemSessionTestContext, table: string): Promise<number> {
  const row = await fixture.database
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .first<{ count: number }>()

  return row?.count ?? 0
}

describe("SystemSessionRepository", () => {
  test("active AccountEntityへhashだけのSessionEntityと監査を同じtransactionで発行する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const repository = new SystemSessionRepository({ context: fixture.context })
    const session = createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt })
    const audit = createAudit({
      action: "auth.session.create",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: createdAt,
    })

    expect(await repository.createWithAudit(session, audit)).toBeUndefined()

    const stored = await repository.find(session.tokenHash)
    expect(stored).toBeInstanceOf(SessionEntity)
    expect(stored instanceof SessionEntity ? stored.id : null).toBe(session.id)
    expect(stored instanceof SessionEntity ? stored.tokenHash : null).toBe(session.tokenHash)
    expect(await getCount(fixture, "system_sessions")).toBe(1)
    expect(await getCount(fixture, "system_audit_events")).toBe(1)
  })

  test.each([
    ["suspended", 0],
    ["locked", 0],
    ["active", 1],
  ] as const)(
    "AccountEntity security stateが一致しない発行を監査ごとrollbackする",
    async (status, version) => {
      const fixture = await SystemSessionTestContext.create()
      await insertAccount(fixture, status, version)
      const repository = new SystemSessionRepository({ context: fixture.context })
      const session = createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt })
      const audit = createAudit({
        action: "auth.session.create",
        targetId: session.id,
        outcome: "succeeded",
        reasonCode: null,
        occurredAt: createdAt,
      })

      expect(await repository.createWithAudit(session, audit)).toBeInstanceOf(Error)
      expect(await getCount(fixture, "system_sessions")).toBe(0)
      expect(await getCount(fixture, "system_audit_events")).toBe(0)
    },
  )

  test("監査insertが黙殺された発行をSessionEntityごとrollbackする", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    await execSql(
      fixture.database,
      `
      CREATE TRIGGER ignore_system_audit_insert
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `,
    )
    const repository = new SystemSessionRepository({ context: fixture.context })
    const session = createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt })
    const audit = createAudit({
      action: "auth.session.create",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: createdAt,
    })

    expect(await repository.createWithAudit(session, audit)).toBeInstanceOf(Error)
    expect(await getCount(fixture, "system_sessions")).toBe(0)
    expect(await getCount(fixture, "system_audit_events")).toBe(0)
  })

  test("一度だけ旧SessionEntityを消費し後継SessionEntityと成功監査を原子的に作る", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const rotation = createRotation()
    await insertSession(
      fixture,
      createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt }),
    )
    const audits = createRotationAudits(rotation)
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, audits)).toBe("rotated")

    const rows = (
      await fixture.database
        .prepare("SELECT id, rotated_at, revoked_at FROM system_sessions ORDER BY id")
        .all<{ id: string; rotated_at: number | null; revoked_at: number | null }>()
    ).results
    expect(rows).toEqual([
      { id: SESSION_ID_1, rotated_at: rotatedAt.getTime(), revoked_at: null },
      { id: SESSION_ID_2, rotated_at: null, revoked_at: null },
    ])
    expect(
      (
        await fixture.database
          .prepare("SELECT event_id FROM system_audit_events")
          .first<{ event_id: string }>()
      )?.event_id,
    ).toBe(audits.rotated.eventId)
  })

  test("同じ旧SessionEntityの並行後発をreuseとしてfamily全体とともに失効する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const rotation = createRotation()
    await insertSession(
      fixture,
      createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt }),
    )
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, createRotationAudits(rotation))).toBe(
      "rotated",
    )
    const reuseAudits = createRotationAudits(rotation)
    expect(await repository.rotateWithAudit(rotation, reuseAudits)).toBe("reused")

    const activeCount = (
      await fixture.database
        .prepare(
          "SELECT COUNT(*) AS count FROM system_sessions WHERE family_id = ?1 AND revoked_at IS NULL",
        )
        .bind(familyId)
        .first<{ count: number }>()
    )?.count
    expect(activeCount).toBe(0)
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events WHERE event_id = ?1")
          .bind(reuseAudits.reused.eventId)
          .first<{ reason_code: string | null }>()
      )?.reason_code,
    ).toBe("refresh_token_reused")
  })

  test("AccountEntity token version変更後のrotationをinvalidとしてfamily全体ごと失効する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const rotation = createRotation()
    await insertSession(
      fixture,
      createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt }),
    )
    await fixture.database
      .prepare("UPDATE system_accounts SET token_version = 1, updated_at = ?1 WHERE id = ?2")
      .bind(rotatedAt.getTime(), accountId)
      .run()
    const audits = createRotationAudits(rotation)
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, audits)).toBe("invalid")
    expect(
      (
        await fixture.database
          .prepare(`SELECT revoked_at FROM system_sessions WHERE id = '${SESSION_ID_1}'`)
          .first<{ revoked_at: number | null }>()
      )?.revoked_at,
    ).toBe(rotatedAt.getTime())
    expect(
      (
        await fixture.database
          .prepare("SELECT reason_code FROM system_audit_events WHERE event_id = ?1")
          .bind(audits.invalid.eventId)
          .first<{ reason_code: string | null }>()
      )?.reason_code,
    ).toBe("session_invalid")
  })

  test("複数の未消費SessionEntityがある壊れたfamilyをinvalidとしてfail closedに失効する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const rotation = createRotation()
    await insertSession(
      fixture,
      createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt }),
    )
    await insertSession(
      fixture,
      createSession({
        id: testLiteralId("unexpected-sibling"),
        tokenHash: "c".repeat(64),
        createdAt,
        expiresAt,
      }),
    )
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, createRotationAudits(rotation))).toBe(
      "invalid",
    )
    expect(
      (
        await fixture.database
          .prepare(
            "SELECT COUNT(*) AS count FROM system_sessions WHERE family_id = ?1 AND revoked_at IS NULL",
          )
          .bind(familyId)
          .first<{ count: number }>()
      )?.count,
    ).toBe(0)
  })

  test("rotation監査insertが黙殺された場合はSessionEntity mutationも残さない", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const rotation = createRotation()
    await insertSession(
      fixture,
      createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt }),
    )
    const audits = createRotationAudits(rotation)
    await execSql(
      fixture.database,
      `
      CREATE TRIGGER ignore_rotation_audit_insert
      BEFORE INSERT ON system_audit_events
      WHEN NEW.event_id = '${audits.rotated.eventId}'
      BEGIN
        SELECT RAISE(IGNORE);
      END;
    `,
    )
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(await repository.rotateWithAudit(rotation, audits)).toBeInstanceOf(Error)
    expect(
      await fixture.database
        .prepare(`SELECT rotated_at, revoked_at FROM system_sessions WHERE id = '${SESSION_ID_1}'`)
        .first<{ rotated_at: number | null; revoked_at: number | null }>(),
    ).toEqual({ rotated_at: null, revoked_at: null })
    expect(await getCount(fixture, "system_audit_events")).toBe(0)
  })

  test("family revokeと監査を同じtransactionで確定する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await insertAccount(fixture)
    const session = createSession({ id: SESSION_ID_1, tokenHash, createdAt, expiresAt })
    await insertSession(fixture, session)
    const audit = createAudit({
      action: "auth.session.logout",
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: rotatedAt,
    })
    const repository = new SystemSessionRepository({ context: fixture.context })

    expect(
      await repository.revokeFamilyWithAudit({
        familyId: session.familyId,
        revokedAt: rotatedAt,
        audit,
      }),
    ).toBeUndefined()
    expect(
      (
        await fixture.database
          .prepare(`SELECT revoked_at FROM system_sessions WHERE id = '${SESSION_ID_1}'`)
          .first<{ revoked_at: number | null }>()
      )?.revoked_at,
    ).toBe(rotatedAt.getTime())
    expect(await getCount(fixture, "system_audit_events")).toBe(1)
  })
})
