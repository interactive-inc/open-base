import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { PrepareSystemAuditAppendInvariantAdapter } from "@system/infrastructure/adapters/audit/prepare-system-audit-append-invariant.adapter"
import type { SystemD1Context } from "@system/configuration/system-context"
import {
  DENIED_AUDIT_WINDOW_MILLISECONDS,
  DENIED_AUDIT_LIMIT_PER_WINDOW,
} from "@system/domain/definitions/audit/denied-audit-limit.definition"
type Context = SystemD1Context

/** 上位コンテキストを持たないSystem監査イベントのappend専用repository。 */
export class SystemAuditEventRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareAppend(
    record: SystemAuditEventEntity,
  ): readonly [D1PreparedStatement, D1PreparedStatement] {
    const database = this.c.env.DB
    const insert = database
      .prepare(
        `INSERT INTO system_audit_events
           (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code,
            authorization_json, before_json, after_json, metadata_json, occurred_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
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

    return Object.freeze([
      insert,
      new PrepareSystemAuditAppendInvariantAdapter(database).prepareSystemAuditAppendInvariant(
        record,
      ),
    ])
  }

  async append(
    record: SystemAuditEventEntity,
    assertions: ReadonlyArray<D1PreparedStatement> = [],
    completionAssertions: ReadonlyArray<D1PreparedStatement> = [],
  ): Promise<void | Error> {
    try {
      const statements = this.prepareAppend(record)
      const results = await this.c.env.DB.batch([
        ...assertions,
        ...statements,
        ...completionAssertions,
      ])

      return results.length === assertions.length + 2 + completionAssertions.length &&
        results.every((result) => result.success)
        ? undefined
        : new Error("audit append did not succeed")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("audit append failed")
    }
  }

  /** 反復可能な拒否だけを原子的に制限し、正常な省略と保存障害を区別する。 */
  async writeDenied(record: SystemAuditEventEntity): Promise<"appended" | "limited" | Error> {
    if (
      record.outcome !== "denied" ||
      record.actorAccountId === null ||
      record.targetType === "auth"
    )
      return new Error("limited audit append requires an account-scoped access denial")
    try {
      const database = this.c.env.DB
      const insert = database
        .prepare(`INSERT INTO system_audit_events
        (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code,
         authorization_json, before_json, after_json, metadata_json, occurred_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
        WHERE (
          SELECT count(*) FROM system_audit_events
          WHERE actor_account_id = ?2 AND outcome = 'denied' AND target_type <> 'auth'
            AND occurred_at >= ?13
        ) < ?14`)
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
          record.occurredAtEpochMilliseconds - DENIED_AUDIT_WINDOW_MILLISECONDS,
          DENIED_AUDIT_LIMIT_PER_WINDOW,
        )
      const results = await database.batch([
        insert,
        new PrepareSystemAuditAppendInvariantAdapter(database).prepareSystemAuditAppendInvariant(
          record,
          true,
        ),
      ])
      if (results.length !== 2 || results.some((result) => !result.success))
        return new Error("audit append did not succeed")
      const changes = results[0]?.meta.changes
      return changes === 1
        ? "appended"
        : changes === 0
          ? "limited"
          : new Error("unexpected audit append count")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("audit append failed")
    }
  }
}
