import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** CLI authorization拒否をSystem監査へfail-closedで記録する。 */
export class SystemCliLoginAuditAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async recordDenied(reasonCode: string, occurredAt: Date): Promise<null | Error> {
    const event = SystemAuditEventEntity.create({
      actorAccountId: null,
      action: SYSTEM_AUDIT_ACTIONS.authSessionCliLoginDenied,
      targetType: "session",
      targetId: null,
      outcome: "denied",
      reasonCode,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt,
    })
    if (event instanceof Error) return event

    const appended = await new SystemAuditEventRepository(this.c).append(event)

    return appended instanceof Error ? appended : null
  }
}
