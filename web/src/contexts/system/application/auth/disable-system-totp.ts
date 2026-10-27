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

type Context = SystemD1Context & SystemDatabaseContext & SystemClockContext

type Props = Readonly<{ accountId: AccountId; code: string; keyMaterial: string }>

/**
 * 本人が二段階認証を無効にする。ワンタイムコードか復旧コードで本人確認し、登録と待機中の
 * ログインの challenge を消す。コードの試行はログインの 2 段目と同じ Account 単位の上限で数える。
 */
export class DisableSystemTotp {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    props: Props,
  ): Promise<Readonly<{ kind: "disabled" }> | SystemTotpChangeRejection | Error> {
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

    const event = SystemAuditEventEntity.create({
      actorAccountId: props.accountId,
      action: SYSTEM_AUDIT_ACTIONS.authTotpDisabled,
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
      { kind: "delete", previous: credential },
      new SystemAuditEventRepository(this.c).prepareAppend(event),
    )
    if (written instanceof Error) return written
    if (written === "conflict")
      return Object.freeze({ kind: "rejected" as const, reason: "invalid_code" as const })

    await rateLimit.resetSecondFactor({ accountId: props.accountId })

    return Object.freeze({ kind: "disabled" })
  }
}
