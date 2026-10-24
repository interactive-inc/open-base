import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { PrepareSystemAuditAppendInvariantAdapter } from "@system/infrastructure/adapters/audit/prepare-system-audit-append-invariant.adapter"
import type { SystemD1Context } from "@system/configuration/system-context"
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
}
