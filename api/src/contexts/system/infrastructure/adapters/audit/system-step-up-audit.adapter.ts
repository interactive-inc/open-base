import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context

/** 再認証の失敗はpasswordを含めず、本人と時刻だけを監査へ残す。 */
export class SystemStepUpAuditAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async recordDenied(accountId: AccountId, now: Date): Promise<void | Error> {
    const event = SystemAuditEventEntity.create({
      actorAccountId: accountId,
      action: SYSTEM_AUDIT_ACTIONS.authStepUpIssued,
      targetType: "system:account",
      targetId: accountId,
      outcome: "denied",
      reasonCode: "invalid_credentials",
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: now,
    })

    if (event instanceof Error) return event

    return new SystemAuditEventRepository(this.c).append(event)
  }
}
