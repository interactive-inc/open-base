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
import {
  matchSystemTotpFactor,
  type SystemTotpChangeRejection,
} from "@system/lib/auth/match-system-totp-factor"
import { generateSystemTotpRecoveryCodes } from "@system/lib/auth/generate-system-totp-recovery-codes"
import { hashSystemTotpRecoveryCode } from "@system/lib/auth/hash-system-totp-recovery-code"

type Context = SystemD1Context & SystemDatabaseContext & SystemClockContext

type Props = Readonly<{ accountId: AccountId; code: string; keyMaterial: string }>

/**
 * 復旧コードをすべて作り直し、新しいコードを一度だけ返す。古いコードは使えなくなる。
 * 本人確認は無効化と同じく、ワンタイムコードか（残っていれば）復旧コードで行う。
 */
export class RegenerateSystemTotpRecoveryCodes {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    props: Props,
  ): Promise<
    Readonly<{ recoveryCodes: ReadonlyArray<string> }> | SystemTotpChangeRejection | Error
  > {
    const now = this.c.var.now()
    if (!Number.isSafeInteger(now.getTime())) return new Error("System clock is invalid")

    const repository = new SystemTotpCredentialRepository(this.c)
    const credential = await repository.find(props.accountId)
    if (credential instanceof Error) return credential
    if (credential === null || !credential.isActive) {
      return Object.freeze({ kind: "rejected" as const, reason: "not_enabled" as const })
    }

    const rateLimit = new LoginRateLimitAdapter(this.c)
    const gate = await rateLimit.recordAndCheckSecondFactor({ accountId: props.accountId })
    if (gate.limited)
      return Object.freeze({ kind: "rejected" as const, reason: "rate_limited" as const })

    const matched = await matchSystemTotpFactor({
      credential,
      code: props.code,
      keyMaterial: props.keyMaterial,
      now,
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

    const replaced = matched.credential.replaceRecoveryCodes(hashes, now)
    if (replaced instanceof Error) return replaced

    const event = SystemAuditEventEntity.create({
      actorAccountId: props.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authTotpRecoveryCodesRegenerated,
      targetType: "system:account",
      targetId: props.accountId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({ method: matched.method }),
      occurredAt: now,
    })
    if (event instanceof Error) return event

    const written = await repository.write(
      { kind: "update", previous: credential, credential: replaced },
      new SystemAuditEventRepository(this.c).prepareAppend(event),
    )
    if (written instanceof Error) return written
    if (written === "conflict")
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_code" as const })

    await rateLimit.resetSecondFactor({ accountId: props.accountId })

    return Object.freeze({ recoveryCodes })
  }
}
