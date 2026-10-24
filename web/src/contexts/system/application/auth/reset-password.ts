import { hashPassword } from "@system/lib/auth/hash-password"
import { SystemPasswordValue } from "@system/domain/values/auth/system-password.value"
import {
  PasswordResetTokenInvalidApplicationError,
  PepperSecretMissingApplicationError,
  SystemAuthPersistenceApplicationError,
} from "@/contexts/system/application/errors"
import { hashPasswordResetToken } from "@system/lib/auth/hash-password-reset-token"
import { FindSystemPasswordResetChallengeAdapter } from "@system/infrastructure/adapters/auth/find-system-password-reset-challenge.adapter"
import { CompleteSystemPasswordResetChallengeAdapter } from "@system/infrastructure/adapters/auth/complete-system-password-reset-challenge.adapter"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemPasswordHashContext,
  SystemRequestAuditContext,
} from "@system/configuration/system-context"

type Props = Readonly<{
  rawToken: string
  newPassword: string
}>
type Context = SystemD1Context &
  SystemClockContext &
  SystemPasswordHashContext &
  SystemRequestAuditContext

export class ResetPassword {
  static readonly featureId = "00450023"

  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(props: Props) {
    const now = this.c.var.now()
    const password = SystemPasswordValue.create(props.newPassword)
    if (!(password instanceof SystemPasswordValue)) {
      return new PasswordResetTokenInvalidApplicationError()
    }

    if (this.c.env.PEPPER_SECRET === undefined || this.c.env.PEPPER_SECRET === "") {
      return new PepperSecretMissingApplicationError()
    }

    const tokenHash = await hashPasswordResetToken(props.rawToken)
    if (tokenHash instanceof Error) return new PasswordResetTokenInvalidApplicationError()
    const challenge = await new FindSystemPasswordResetChallengeAdapter(
      this.c,
    ).findSystemPasswordResetChallenge(tokenHash, now)
    if (challenge instanceof Error) return new SystemAuthPersistenceApplicationError(challenge)
    if (challenge === null) return new PasswordResetTokenInvalidApplicationError()
    const passwordHash = await hashPassword(password.toString(), this.c.env.PEPPER_SECRET)
    const metadataJson = StableSystemAuditJsonValue.create({
      client_ip: this.c.var.auditContext.clientIp,
      client_name: this.c.var.auditContext.clientName,
      request_id: this.c.var.auditContext.requestId,
    })
    if (metadataJson instanceof Error)
      return new SystemAuthPersistenceApplicationError(metadataJson)
    const completed = await new CompleteSystemPasswordResetChallengeAdapter(
      this.c,
    ).completeSystemPasswordResetChallenge({
      challengeId: challenge.id,
      tokenHash,
      accountId: challenge.accountId,
      identityId: challenge.identityId,
      accountTokenVersion: challenge.accountTokenVersion,
      passwordHash,
      completedAt: now,
      metadataJson: metadataJson?.toString() ?? null,
    })

    if (completed instanceof Error) return new SystemAuthPersistenceApplicationError(completed)
    if (completed === false) return new PasswordResetTokenInvalidApplicationError()

    return {
      ok: true as const,
      accountId: challenge.accountId,
      accountTokenVersion: challenge.accountTokenVersion + 1,
    }
  }
}
