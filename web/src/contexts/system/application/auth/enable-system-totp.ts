import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemTotpCredentialRepository } from "@system/infrastructure/repositories/auth/system-totp-credential.repository"
import { decryptSystemTotpSecret } from "@system/lib/auth/decrypt-system-totp-secret"
import { generateSystemTotpRecoveryCodes } from "@system/lib/auth/generate-system-totp-recovery-codes"
import { hashSystemTotpRecoveryCode } from "@system/lib/auth/hash-system-totp-recovery-code"
import { verifySystemTotpCode } from "@system/lib/auth/verify-system-totp-code"

type Context = SystemD1Context & SystemDatabaseContext & SystemClockContext

type Props = Readonly<{ accountId: AccountId; code: string; keyMaterial: string }>

export type SystemTotpActivation = Readonly<{ recoveryCodes: ReadonlyArray<string> }>

export type SystemTotpActivationRejection = Readonly<{
  kind: "rejected"
  reason: "not_pending" | "invalid_code" | "rate_limited"
}>

/**
 * 認証アプリに表示された最初のコードを確かめて登録を有効にし、復旧コードを一度だけ返す。
 * 有効化は監査と同じbatchで確定させる。コードの試行はログインの 2 段目と同じ Account 単位の
 * 上限で数え、session を盗んだ第三者が総当たりで有効化して本人を締め出すことを防ぐ。
 */
export class EnableSystemTotp {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    props: Props,
  ): Promise<SystemTotpActivation | SystemTotpActivationRejection | Error> {
    const now = this.c.var.now()
    if (!Number.isSafeInteger(now.getTime())) return new Error("System clock is invalid")

    const repository = new SystemTotpCredentialRepository(this.c)
    const credential = await repository.find(props.accountId)
    if (credential instanceof Error) return credential
    if (credential === null || credential.status !== "pending") {
      return Object.freeze({ kind: "rejected" as const, reason: "not_pending" as const })
    }

    const rateLimit = new LoginRateLimitAdapter(this.c)
    const gate = await rateLimit.recordAndCheckSecondFactor({ accountId: props.accountId })
    if (gate.limited)
      return Object.freeze({ kind: "rejected" as const, reason: "rate_limited" as const })

    const secret = await decryptSystemTotpSecret(credential, props.keyMaterial)
    if (secret instanceof Error) return secret

    const matched = await verifySystemTotpCode({
      secret,
      code: props.code,
      now,
      lastUsedStep: null,
    })
    if (matched instanceof Error) return matched
    if (matched === null)
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_code" as const })

    const recoveryCodes = generateSystemTotpRecoveryCodes()
    const hashes: Array<string> = []
    for (const code of recoveryCodes) {
      const hash = await hashSystemTotpRecoveryCode(code)
      if (hash instanceof Error) return hash
      hashes.push(hash)
    }

    const enabled = credential.enable({ step: matched.step, recoveryCodeHashes: hashes, now })
    if (enabled instanceof Error) return enabled

    const event = SystemAuditEventEntity.create({
      actorAccountId: props.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authTotpEnabled,
      targetType: "system:account",
      targetId: props.accountId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: now,
    })
    if (event instanceof Error) return event

    const written = await repository.write(
      { kind: "update", previous: credential, credential: enabled },
      new SystemAuditEventRepository(this.c).prepareAppend(event),
    )
    if (written instanceof Error) return written
    if (written === "conflict")
      return Object.freeze({ kind: "rejected" as const, reason: "not_pending" as const })

    await rateLimit.resetSecondFactor({ accountId: props.accountId })

    return Object.freeze({ recoveryCodes })
  }
}
