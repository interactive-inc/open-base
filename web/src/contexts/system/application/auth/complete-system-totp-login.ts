import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import {
  matchSystemTotpFactor,
  type SystemTotpFactorMethod,
} from "@system/lib/auth/match-system-totp-factor"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemTotpCredentialRepository } from "@system/infrastructure/repositories/auth/system-totp-credential.repository"
import { SystemTotpLoginChallengeRepository } from "@system/infrastructure/repositories/auth/system-totp-login-challenge.repository"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"

type Context = SystemD1Context & SystemDatabaseContext & SystemClockContext

type Props = Readonly<{ challenge: string; code: string; keyMaterial: string }>

export type SystemTotpLoginCompletion = Readonly<{
  kind: "completed"
  accountId: AccountId
  tokenVersion: number
  method: SystemTotpFactorMethod
  remainingRecoveryCodes: number
}>

export type SystemTotpLoginRejection = Readonly<{
  kind: "rejected"
  reason: "invalid_challenge" | "invalid_code" | "rate_limited"
  accountId: AccountId | null
}>

/**
 * ログインの 2 段目。challenge とワンタイムコード（または復旧コード）を確かめ、コードの使用と
 * challenge の消費を同じbatchで確定させる。session の発行は呼び出し側（製品）が行う。
 */
export class CompleteSystemTotpLogin {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    props: Props,
  ): Promise<SystemTotpLoginCompletion | SystemTotpLoginRejection | Error> {
    const now = this.c.var.now()
    if (!Number.isSafeInteger(now.getTime())) return new Error("System clock is invalid")

    const challengeHash = await systemLoginCodeHash(props.challenge)
    if (challengeHash instanceof Error) return challengeHash

    const challenges = new SystemTotpLoginChallengeRepository(this.c)
    const challenge = await challenges.find(challengeHash)
    if (challenge instanceof Error) return challenge
    if (challenge === null || !challenge.acceptsCodeAt(now)) {
      return this.rejected("invalid_challenge", challenge?.accountId ?? null)
    }

    const rateLimit = new LoginRateLimitAdapter(this.c)
    const gate = await rateLimit.recordAndCheckSecondFactor({ accountId: challenge.accountId })
    if (gate.limited) return this.rejected("rate_limited", challenge.accountId)

    const repository = new SystemTotpCredentialRepository(this.c)
    const credential = await repository.find(challenge.accountId)
    if (credential instanceof Error) return credential
    if (credential === null || !credential.isActive) {
      return this.rejected("invalid_challenge", challenge.accountId)
    }

    const matched = await matchSystemTotpFactor({
      credential,
      code: props.code,
      keyMaterial: props.keyMaterial,
      now,
    })
    if (matched instanceof Error) return matched

    const audit = new SystemAuditEventRepository(this.c)

    if (matched === null) {
      const denied = SystemAuditEventEntity.create({
        actorAccountId: challenge.accountId,
        action: SYSTEM_AUDIT_ACTIONS.authTotpLoginDenied,
        targetType: "system:account",
        targetId: challenge.accountId,
        outcome: "denied",
        reasonCode: "invalid_code",
        authorizationJson: null,
        beforeJson: null,
        afterJson: null,
        metadataJson: null,
        occurredAt: now,
      })
      if (denied instanceof Error) return denied

      const recorded = await challenges.recordFailure(challenge, audit.prepareAppend(denied))
      if (recorded instanceof Error) return recorded

      return this.rejected("invalid_code", challenge.accountId)
    }

    const recoveryCodeUsed =
      matched.method === "recovery_code"
        ? SystemAuditEventEntity.create({
            actorAccountId: challenge.accountId,
            action: SYSTEM_AUDIT_ACTIONS.authTotpRecoveryCodeUsed,
            targetType: "system:account",
            targetId: challenge.accountId,
            outcome: "succeeded",
            reasonCode: null,
            authorizationJson: null,
            beforeJson: null,
            afterJson: null,
            metadataJson: JSON.stringify({
              remaining_recovery_codes: matched.credential.recoveryCodeHashes.length,
            }),
            occurredAt: now,
          })
        : null
    if (recoveryCodeUsed instanceof Error) return recoveryCodeUsed

    const written = await repository.write(
      { kind: "update", previous: credential, credential: matched.credential },
      [
        ...challenges.prepareConsume(challenge, now),
        ...(recoveryCodeUsed === null ? [] : audit.prepareAppend(recoveryCodeUsed)),
      ],
    )
    if (written instanceof Error) return written
    if (written === "conflict") return this.rejected("invalid_challenge", challenge.accountId)

    await rateLimit.resetSecondFactor({ accountId: challenge.accountId })

    return Object.freeze({
      kind: "completed",
      accountId: challenge.accountId,
      tokenVersion: challenge.tokenVersion,
      method: matched.method,
      remainingRecoveryCodes: matched.credential.recoveryCodeHashes.length,
    })
  }

  private rejected(
    reason: SystemTotpLoginRejection["reason"],
    accountId: AccountId | null,
  ): SystemTotpLoginRejection {
    return Object.freeze({ kind: "rejected" as const, reason, accountId })
  }
}
