import { IssueSystemSession } from "@system/application/auth/issue-system-session"
import { RevokeSystemSession } from "@system/application/auth/revoke-system-session"
import { RotateSystemSession } from "@system/application/auth/rotate-system-session"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemSessionMaterialService } from "@system/lib/auth/system-session-material-service"
import { SystemSessionRepository } from "@system/infrastructure/repositories/auth/system-session.repository"
import type { SystemD1Context } from "@system/configuration/system-context"

type Props = Readonly<{
  context: SystemD1Context
  jwtSecret: string
  sessionTtlMilliseconds: number
  sessionMaxLifetimeMilliseconds?: number
}>

export type SystemSessionApplications = Readonly<{
  issue: IssueSystemSession
  authenticate: Readonly<{
    execute: (
      command: Readonly<{ rawToken: string; now: Date }>,
    ) => ReturnType<SystemSessionRepository["authenticate"]>
  }>
  rotate: RotateSystemSession
  revoke: RevokeSystemSession
}>

/** System Sessionの各操作を結合テスト用に配線する。 */
export function createSystemSessionApplications(props: Props): SystemSessionApplications | Error {
  if (!Number.isSafeInteger(props.sessionTtlMilliseconds) || props.sessionTtlMilliseconds <= 0) {
    return new Error("System Session lifetime is invalid")
  }

  const accountRepository = new SystemAccountRepository({ database: props.context.env.DB })
  const sessionRepository = new SystemSessionRepository({ context: props.context })
  const auditAppender = new SystemAuditEventRepository(props.context)
  const materialService = new SystemSessionMaterialService()
  const accessTokenIssuer = new SystemAccessTokenIssuer(props.jwtSecret)

  return Object.freeze({
    issue: new IssueSystemSession({
      accountRepository,
      sessionRepository,
      materialService,
      accessTokenIssuer,
      sessionTtlMilliseconds: props.sessionTtlMilliseconds,
      sessionMaxLifetimeMilliseconds: props.sessionMaxLifetimeMilliseconds ?? 2_592_000_000,
    }),
    authenticate: Object.freeze({
      execute: (command: Parameters<SystemSessionRepository["authenticate"]>[0]) =>
        sessionRepository.authenticate(command, materialService),
    }),
    rotate: new RotateSystemSession({
      accountRepository,
      sessionRepository,
      auditAppender,
      materialService,
      accessTokenIssuer,
      sessionTtlMilliseconds: props.sessionTtlMilliseconds,
      sessionMaxLifetimeMilliseconds: props.sessionMaxLifetimeMilliseconds ?? 2_592_000_000,
    }),
    revoke: new RevokeSystemSession({ sessionRepository, materialService }),
  })
}
