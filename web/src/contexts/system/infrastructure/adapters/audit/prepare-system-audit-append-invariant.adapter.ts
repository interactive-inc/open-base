import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
type PrepareSystemAuditAppendInvariantAdapterContext = D1Database
type Context = PrepareSystemAuditAppendInvariantAdapterContext

/** append後のSystem監査イベントが入力と完全一致することをtransaction内で検証する。 */
export class PrepareSystemAuditAppendInvariantAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareSystemAuditAppendInvariant(record: SystemAuditEventEntity): D1PreparedStatement {
    return this.c
      .prepare(
        `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM system_audit_events
         WHERE event_id = ?1
           AND actor_account_id IS ?2
           AND action = ?3
           AND target_type = ?4
           AND target_id IS ?5
           AND outcome = ?6
           AND reason_code IS ?7
           AND authorization_json IS ?8
           AND before_json IS ?9
           AND after_json IS ?10
           AND metadata_json IS ?11
           AND occurred_at = ?12
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
      )
      .bind(
        record.eventId,
        record.actorAccountId,
        record.action,
        record.targetType,
        record.targetId,
        record.outcome,
        record.reasonCode,
        record.authorizationJson,
        record.beforeJson,
        record.afterJson,
        record.metadataJson,
        record.occurredAtEpochMilliseconds,
      )
  }
}
