import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { SystemSessionAuditContext } from "@system/domain/definitions/audit/system-session-audit-context.definition"
import type { SystemSessionMaterial } from "@system/domain/definitions/auth/system-session-issuance.definition"
import type { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"

type Props = Readonly<{
  sessionRepository: Pick<SystemSessionRepository, "find" | "revokeFamilyWithAudit">
  materialService: Pick<SystemSessionMaterial, "hashRawToken">
}>

export type RevokeSystemSessionCommand = Readonly<{
  rawToken: string
  now: Date
  auditContext: SystemSessionAuditContext
}>

export type RevokeSystemSessionResult = Readonly<{ kind: "completed" }>
type RevokeSystemSessionContext = Props
type Context = RevokeSystemSessionContext

/** システムセッションを失効する。 */
export class RevokeSystemSession {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(command: RevokeSystemSessionCommand): Promise<RevokeSystemSessionResult | Error> {
    if (!Number.isSafeInteger(command.now.getTime())) {
      return new Error("System Session revocation time is invalid")
    }

    const tokenHash = await this.c.materialService.hashRawToken(command.rawToken)
    if (tokenHash instanceof Error) return tokenHash
    const session = await this.c.sessionRepository.find(tokenHash)
    if (session instanceof Error) return session
    if (session === null || session.revokedAt !== null) return RevokeSystemSession.completed()

    const audit = SystemAuditEventEntity.createSession({
      actorAccountId: session.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authSessionRevoke,
      targetId: session.id,
      outcome: "succeeded",
      reasonCode: null,
      occurredAt: command.now,
      context: command.auditContext,
    })
    if (audit instanceof Error) return audit

    const revocationError = await this.c.sessionRepository.revokeFamilyWithAudit({
      familyId: session.familyId,
      revokedAt: command.now,
      audit,
    })

    return revocationError instanceof Error ? revocationError : RevokeSystemSession.completed()
  }

  private static completed(): RevokeSystemSessionResult {
    return Object.freeze({ kind: "completed" as const })
  }
}
