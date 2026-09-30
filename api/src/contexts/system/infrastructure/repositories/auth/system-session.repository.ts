import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { RefreshTokenRotationDecision } from "@system/domain/definitions/auth/refresh-token-rotation-decision.definition"
import type { SessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import type { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import type { SessionTokenHash } from "@system/domain/schemas/auth/session-token-hash.schema"
import type { SessionEntity } from "@system/domain/entities/session.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SessionId } from "@system/domain/schemas/auth/session-id.schema"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
import { parseSystemSessionRotationResult } from "@system/lib/auth/parse-system-session-rotation-result"
import { PrepareSystemSessionCreateInvariantAdapter } from "@system/infrastructure/adapters/auth/prepare-system-session-create-invariant.adapter"
import { PrepareSystemSessionRotationAuditAdapter } from "@system/infrastructure/adapters/auth/prepare-system-session-rotation-audit.adapter"
import { PrepareSystemSessionRotationInvariantAdapter } from "@system/infrastructure/adapters/auth/prepare-system-session-rotation-invariant.adapter"
import { toSystemSession } from "@system/lib/auth/to-system-session"
import { validateSystemSessionRotationAudits } from "@system/lib/auth/validate-system-session-rotation-audits"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"

type Props = Readonly<{
  context: SystemD1Context
}>

export type RevokeSessionFamilyProps = Readonly<{
  familyId: SessionFamilyId
  revokedAt: Date
  audit: SystemAuditEventEntity
}>

export type SystemSessionAuthentication =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      tokenVersion: number
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{ kind: "rejected"; reason: "invalid" }>
type SystemSessionRepositoryContext = Props
type Context = SystemSessionRepositoryContext

/** canonical System tableだけでSessionEntity lifecycleと監査を原子的に永続化する。 */
export class SystemSessionRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createWithAudit(
    session: SessionEntity,
    audit: SystemAuditEventEntity,
  ): Promise<void | Error> {
    if (session.rotatedAt !== null || session.revokedAt !== null) {
      return new Error("new System SessionEntity must be active")
    }

    try {
      const database = this.c.context.env.DB
      const auditStatements = new SystemAuditEventRepository(this.c.context).prepareAppend(audit)
      const results = await database.batch([
        this.prepareCreate(session),
        new PrepareSystemSessionCreateInvariantAdapter(
          database,
        ).prepareSystemSessionCreateInvariant(session),
        ...auditStatements,
      ])

      return results.length === 4 && results.every((result) => result.success)
        ? undefined
        : new Error("audited System SessionEntity creation did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create System SessionEntity")
    }
  }

  /**
   * 絶対寿命の起点を持たない行（列の追加前に作られ、backfill後に旧workerが書いた行）は、
   * 同じfamilyで最も早く作られた行の時刻を起点にし、refreshによる延長を許さない。
   */
  async find(tokenHash: SessionTokenHash): Promise<SessionEntity | null | Error> {
    try {
      const storageRow = await this.c.context.env.DB.prepare(
        `SELECT session.id, session.account_id, session.family_id, session.token_hash,
                session.token_version,
                coalesce(session.authenticated_at, (
                  SELECT min(family.created_at) FROM system_sessions AS family
                  WHERE family.family_id = session.family_id
                )) AS authenticated_at,
                session.created_at, session.expires_at, session.rotated_at, session.revoked_at
         FROM system_sessions AS session
         WHERE session.token_hash = ?1
         LIMIT 1`,
      )
        .bind(tokenHash)
        .first<Record<string, unknown>>()

      return storageRow === null ? null : toSystemSession(storageRow)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to find System SessionEntity")
    }
  }

  async authenticate(
    command: Readonly<{ rawToken: string; now: Date }>,
    materialService: Readonly<{
      hashRawToken: (rawToken: string) => Promise<SessionTokenHash | Error>
    }>,
  ): Promise<SystemSessionAuthentication | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System Session authentication time is invalid")
    }

    const tokenHash = await materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const session = await this.find(tokenHash)
    if (session instanceof Error) return session
    if (session === null || session.getUseRejection(command.now) !== null) {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
    }

    const accountSession = await SystemAccountRepository.resolveSession({
      accountRepository: new SystemAccountRepository({ database: this.c.context.env.DB }),
      accountId: session.accountId,
      sessionTokenVersion: session.tokenVersion,
    })
    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
    }

    return Object.freeze({
      kind: "authenticated" as const,
      accountId: accountSession.account.id,
      tokenVersion: accountSession.account.tokenVersion,
      sessionId: session.id,
      expiresAt: session.expiresAt,
    })
  }

  async rotateWithAudit(
    rotation: SessionRotationValue,
    audits: SessionRotationAuditEvents,
  ): Promise<RefreshTokenRotationDecision | Error> {
    const validationError = validateSystemSessionRotationAudits(rotation, audits)

    if (validationError !== null) return validationError

    try {
      const database = this.c.context.env.DB
      const results = await database.batch([
        new PrepareSystemSessionRotationAuditAdapter().prepareSystemSessionRotationAudit({
          database,
          rotation,
          audits,
        }),
        this.prepareConsumePrevious(rotation, audits),
        this.prepareCreateSuccessor(rotation, audits),
        this.prepareRevokeRejectedFamily(rotation, audits),
        new PrepareSystemSessionRotationInvariantAdapter().prepareSystemSessionRotationInvariant({
          database,
          rotation,
          audits,
        }),
      ])

      if (results.length !== 5 || results.some((result) => !result.success)) {
        return new Error("audited System SessionEntity rotation did not succeed")
      }

      return parseSystemSessionRotationResult(results[0], audits)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to rotate System SessionEntity")
    }
  }

  async revokeFamilyWithAudit(props: RevokeSessionFamilyProps): Promise<void | Error> {
    if (!Number.isFinite(props.revokedAt.getTime())) {
      return new Error("System SessionEntity family revocation time is invalid")
    }

    try {
      const database = this.c.context.env.DB
      const auditStatements = new SystemAuditEventRepository(this.c.context).prepareAppend(
        props.audit,
      )
      const results = await database.batch([
        database
          .prepare(
            `UPDATE system_sessions
             SET revoked_at = ?1
             WHERE family_id = ?2
               AND revoked_at IS NULL
               AND created_at <= ?1
               AND (rotated_at IS NULL OR rotated_at <= ?1)`,
          )
          .bind(props.revokedAt.getTime(), props.familyId),
        ...auditStatements,
        database
          .prepare(
            `SELECT CASE WHEN NOT EXISTS (
               SELECT 1 FROM system_sessions WHERE family_id = ?1 AND revoked_at IS NULL
             ) THEN 1 ELSE json_extract('', '$') END AS ok`,
          )
          .bind(props.familyId),
      ])

      return results.length === 4 && results.every((result) => result.success)
        ? undefined
        : new Error("audited System SessionEntity family revocation did not succeed")
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to revoke System SessionEntity family")
    }
  }

  private prepareCreate(session: SessionEntity): D1PreparedStatement {
    return this.c.context.env.DB.prepare(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version,
          created_at, expires_at, rotated_at, revoked_at, authenticated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?8
       WHERE EXISTS (
         SELECT 1 FROM system_accounts
         WHERE id = ?2 AND status = 'active' AND token_version = ?5
       )
       RETURNING id`,
    ).bind(
      session.id,
      session.accountId,
      session.familyId,
      session.tokenHash,
      session.tokenVersion,
      session.createdAt.getTime(),
      session.expiresAt.getTime(),
      session.authenticatedAt.getTime(),
    )
  }

  private prepareConsumePrevious(
    rotation: SessionRotationValue,
    audits: SessionRotationAuditEvents,
  ): D1PreparedStatement {
    const previous = rotation.previous

    return this.c.context.env.DB.prepare(
      `UPDATE system_sessions
       SET rotated_at = ?1
       WHERE id = ?2 AND token_hash = ?3 AND account_id = ?4 AND family_id = ?5
         AND token_version = ?6 AND created_at = ?7 AND expires_at = ?8
         AND rotated_at IS NULL AND revoked_at IS NULL
         AND EXISTS (SELECT 1 FROM system_audit_events WHERE event_id = ?9)`,
    ).bind(
      previous.rotatedAt?.getTime() ?? Number.NaN,
      previous.id,
      previous.tokenHash,
      previous.accountId,
      previous.familyId,
      previous.tokenVersion,
      previous.createdAt.getTime(),
      previous.expiresAt.getTime(),
      audits.rotated.eventId,
    )
  }

  private prepareCreateSuccessor(
    rotation: SessionRotationValue,
    audits: SessionRotationAuditEvents,
  ): D1PreparedStatement {
    const previous = rotation.previous
    const successor = rotation.successor

    return this.c.context.env.DB.prepare(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version,
          created_at, expires_at, rotated_at, revoked_at, authenticated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL, ?11
       WHERE EXISTS (SELECT 1 FROM system_audit_events WHERE event_id = ?8)
         AND EXISTS (
           SELECT 1 FROM system_sessions
           WHERE id = ?9 AND token_hash = ?10 AND rotated_at = ?6 AND revoked_at IS NULL
         )`,
    ).bind(
      successor.id,
      successor.accountId,
      successor.familyId,
      successor.tokenHash,
      successor.tokenVersion,
      successor.createdAt.getTime(),
      successor.expiresAt.getTime(),
      audits.rotated.eventId,
      previous.id,
      previous.tokenHash,
      successor.authenticatedAt.getTime(),
    )
  }

  private prepareRevokeRejectedFamily(
    rotation: SessionRotationValue,
    audits: SessionRotationAuditEvents,
  ): D1PreparedStatement {
    const previous = rotation.previous

    return this.c.context.env.DB.prepare(
      `UPDATE system_sessions
       SET revoked_at = ?1
       WHERE family_id = ?2 AND revoked_at IS NULL
         AND EXISTS (
           SELECT 1 FROM system_audit_events WHERE event_id IN (?3, ?4)
         )`,
    ).bind(
      previous.rotatedAt?.getTime() ?? Number.NaN,
      previous.familyId,
      audits.reused.eventId,
      audits.invalid.eventId,
    )
  }
}
