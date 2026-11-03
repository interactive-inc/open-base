import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import {
  DENIED_AUDIT_WINDOW_MILLISECONDS,
  DENIED_AUDIT_LIMIT_PER_WINDOW,
} from "@system/domain/definitions/audit/denied-audit-limit.definition"
type PrepareSystemAuditAppendInvariantAdapterContext = D1Database
type Context = PrepareSystemAuditAppendInvariantAdapterContext

/** 保存行の完全一致、または拒否専用の上限による省略をtransaction内で検証する。 */
export class PrepareSystemAuditAppendInvariantAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareSystemAuditAppendInvariant(
    record: SystemAuditEventEntity,
    allowLimitedDenial = false,
  ): D1PreparedStatement {
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
       ) ${
         allowLimitedDenial
           ? `OR (
         NOT EXISTS (SELECT 1 FROM system_audit_events WHERE event_id = ?1)
         AND (SELECT count(*) FROM system_audit_events
           WHERE actor_account_id = ?2 AND outcome = 'denied' AND target_type <> 'auth'
             AND occurred_at >= ?13) >= ?14
       )`
           : ""
       } THEN 1 ELSE json_extract('', '$') END AS ok`,
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
        ...(allowLimitedDenial
          ? [
              record.occurredAtEpochMilliseconds - DENIED_AUDIT_WINDOW_MILLISECONDS,
              DENIED_AUDIT_LIMIT_PER_WINDOW,
            ]
          : []),
      )
  }
}
