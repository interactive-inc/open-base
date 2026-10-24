import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import type { SystemSessionAuditContext } from "@system/domain/definitions/audit/system-session-audit-context.definition"
import type {
  SystemAccessTokenIssuer,
  SystemSessionMaterial,
} from "@system/domain/definitions/auth/system-session-issuance.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SessionId } from "@system/domain/schemas/auth/session-id.schema"
import { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"
import { SessionEntity } from "@system/domain/entities/session.entity"
import type { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"

export type SystemAuditEventAppender = Readonly<{
  append: (event: SystemAuditEventEntity) => Promise<void | Error>
}>

type Props = Readonly<{
  accountRepository: Pick<SystemAccountRepository, "find">
  sessionRepository: Pick<
    SystemSessionRepository,
    "find" | "revokeFamilyWithAudit" | "rotateWithAudit"
  >
  auditAppender: SystemAuditEventAppender
  materialService: SystemSessionMaterial
  accessTokenIssuer: SystemAccessTokenIssuer
  sessionTtlMilliseconds: number
  sessionMaxLifetimeMilliseconds: number
}>

export type RotateSystemSessionCommand = Readonly<{
  rawToken: string
  now: Date
  auditContext: SystemSessionAuditContext
}>

export type RotateSystemSessionResult =
  | Readonly<{
      kind: "rotated"
      accountId: AccountId
      tokenVersion: number
      accessToken: string
      rawToken: string
      sessionId: SessionId
      expiresAt: Date
    }>
  | Readonly<{ kind: "rejected"; reason: "reused" | "invalid" }>
type RotateSystemSessionContext = Props
type Context = RotateSystemSessionContext

/**
 * システムセッションをローテーションする。後継はfamilyの認証時刻を引き継ぎ、
 * 絶対寿命を過ぎたfamilyはrefreshを拒否して失効させ、再ログインを求める。
 */
export class RotateSystemSession {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: RotateSystemSessionCommand): Promise<RotateSystemSessionResult | Error> {
    const nowEpochMilliseconds = command.now.getTime()
    const expiresAtEpochMilliseconds = nowEpochMilliseconds + this.c.sessionTtlMilliseconds

    if (
      !Number.isSafeInteger(nowEpochMilliseconds) ||
      !Number.isSafeInteger(this.c.sessionTtlMilliseconds) ||
      this.c.sessionTtlMilliseconds <= 0 ||
      !Number.isSafeInteger(this.c.sessionMaxLifetimeMilliseconds) ||
      this.c.sessionMaxLifetimeMilliseconds <= 0 ||
      !Number.isSafeInteger(expiresAtEpochMilliseconds)
    ) {
      return new Error("System SessionEntity rotation time is invalid")
    }

    const tokenHash = await this.c.materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const current = await this.c.sessionRepository.find(tokenHash)
    if (current instanceof Error) return current
    if (current === null) return this.rejectUnknown(command)

    const useRejection = current.getUseRejection(command.now)
    if (useRejection === "rotated" || useRejection === "revoked") {
      return this.rejectKnown(current, "reused", command)
    }
    const lifetimeEnd = current.getLifetimeEnd(this.c.sessionMaxLifetimeMilliseconds)
    if (
      lifetimeEnd === null ||
      current.exceedsLifetime(command.now, this.c.sessionMaxLifetimeMilliseconds)
    ) {
      return this.rejectKnown(current, "invalid", command, "session_lifetime_exceeded")
    }
    if (useRejection !== null) return this.rejectKnown(current, "invalid", command)

    const accountSession = await SystemAccountRepository.resolveSession({
      accountRepository: this.c.accountRepository,
      accountId: current.accountId,
      sessionTokenVersion: current.tokenVersion,
    })
    if (accountSession instanceof Error) return accountSession
    if (accountSession.kind === "rejected") {
      return this.rejectKnown(current, "invalid", command)
    }

    const sessionId = this.c.materialService.generateSessionId()
    if (sessionId instanceof Error) return sessionId
    const rawToken = this.c.materialService.generateRawToken()
    if (rawToken instanceof Error) return rawToken
    const successorTokenHash = await this.c.materialService.hashRawToken(rawToken)
    if (successorTokenHash instanceof Error) return successorTokenHash

    const expiresAt = new Date(Math.min(expiresAtEpochMilliseconds, lifetimeEnd.getTime()))
    const successor = SessionEntity.create({
      id: sessionId,
      accountId: current.accountId,
      familyId: current.familyId,
      tokenHash: successorTokenHash,
      tokenVersion: accountSession.account.tokenVersion,
      authenticatedAt: current.authenticatedAt,
      createdAt: command.now,
      expiresAt,
      rotatedAt: null,
      revokedAt: null,
    })
    if (successor instanceof Error) return successor

    const rotation = SessionRotationValue.create(current, successor, command.now)
    if (rotation instanceof Error) return rotation
    const audits = SystemAuditEventEntity.createSessionRotationEvents(
      rotation,
      command.auditContext,
    )
    if (audits instanceof Error) return audits

    const accessToken = await this.c.accessTokenIssuer.issue({
      accountId: successor.accountId,
      tokenVersion: successor.tokenVersion,
      sessionFamilyId: successor.familyId,
      now: command.now,
    })
    if (accessToken instanceof Error) return accessToken

    const decision = await this.c.sessionRepository.rotateWithAudit(rotation, audits)
    if (decision instanceof Error) return decision
    if (decision !== "rotated") {
      return Object.freeze({ kind: "rejected" as const, reason: decision })
    }

    return Object.freeze({
      kind: "rotated" as const,
      accountId: successor.accountId,
      tokenVersion: successor.tokenVersion,
      accessToken,
      rawToken,
      sessionId: successor.id,
      expiresAt,
    })
  }

  private async rejectUnknown(
    command: RotateSystemSessionCommand,
  ): Promise<RotateSystemSessionResult | Error> {
    const audit = SystemAuditEventEntity.createSession({
      actorAccountId: null,
      action: SYSTEM_AUDIT_ACTIONS.authSessionRotate,
      targetId: null,
      outcome: "denied",
      reasonCode: "session_invalid",
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit
    const appendError = await this.c.auditAppender.append(audit)

    return appendError instanceof Error
      ? appendError
      : Object.freeze({ kind: "rejected" as const, reason: "invalid" as const })
  }

  private async rejectKnown(
    current: SessionEntity,
    reason: "reused" | "invalid",
    command: RotateSystemSessionCommand,
    reasonCode:
      | "refresh_token_reused"
      | "session_invalid"
      | "session_lifetime_exceeded" = reason === "reused"
      ? "refresh_token_reused"
      : "session_invalid",
  ): Promise<RotateSystemSessionResult | Error> {
    const audit = SystemAuditEventEntity.createSession({
      actorAccountId: current.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authSessionRotate,
      targetId: current.id,
      outcome: "denied",
      reasonCode,
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit
    const revocationError = await this.c.sessionRepository.revokeFamilyWithAudit({
      familyId: current.familyId,
      revokedAt: command.now,
      audit,
    })

    return revocationError instanceof Error
      ? revocationError
      : Object.freeze({ kind: "rejected" as const, reason })
  }
}
