import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordSourceFreezeEntity } from "@system/domain/entities/record-source-freeze.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 停止の世代・監査を同じtransactionへ保存し、解除は読取時の全状態と照合する。 */
export class RecordSourceFreezeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(id: string): Promise<RecordSourceFreezeEntity | null | Error> {
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(
          "SELECT snapshot_json FROM system_record_source_freezes WHERE id=?1",
        ).bind(id),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch<{ snapshot_json: string }>(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("record source freeze lookup failed")
      const row = results[this.c.assertions.length]?.results[0]
      if (row === undefined) return null
      const freeze = RecordSourceFreezeEntity.create(JSON.parse(row.snapshot_json))
      if (freeze instanceof Error || JSON.stringify(freeze.snapshot) !== row.snapshot_json)
        return new Error("stored record source freeze is invalid")
      return freeze
    } catch (cause) {
      return new Error("record source freeze lookup failed", { cause })
    }
  }

  /** 読取と後続の確定を同じ未解除の停止世代へ束縛する。 */
  async prepareActiveGeneration(
    input: Readonly<{ id: string; sourceNamespace: string; ownerContext: string }>,
  ) {
    const freeze = await this.find(input.id)
    if (freeze instanceof Error) return freeze
    if (freeze === null || !freeze.matchesActiveGeneration(input))
      return new Error("active source freeze generation required")
    return Object.freeze({
      freeze,
      assertions: Object.freeze([
        ...this.c.assertions,
        this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM system_record_source_freezes WHERE id=?1 AND snapshot_json IS ?2 AND revision=1
        ) THEN 1 ELSE json_extract('{}','record_source_freeze_generation_changed') END`).bind(
          input.id,
          JSON.stringify(freeze.snapshot),
        ),
      ]),
    })
  }

  async write(
    freeze: RecordSourceFreezeEntity,
    audit: SystemAuditEventEntity,
    previous: RecordSourceFreezeEntity | null = null,
  ): Promise<"written" | "conflict" | Error> {
    const value = freeze.snapshot
    const db = this.c.env.DB
    const mutation =
      previous === null
        ? db
            .prepare(`INSERT INTO system_record_source_freezes
          (id,source_namespace,owner_context,revision,created_audit_event_id,release_audit_event_id,snapshot_json)
          VALUES (?1,?2,?3,?4,?5,?6,?7)`)
            .bind(
              value.id,
              value.sourceNamespace,
              value.ownerContext,
              value.revision,
              value.auditEventId,
              value.release?.auditEventId ?? null,
              JSON.stringify(value),
            )
        : db
            .prepare(`UPDATE system_record_source_freezes SET revision=?1,release_audit_event_id=?2,snapshot_json=?3
          WHERE id=?4 AND snapshot_json IS ?5`)
            .bind(
              value.revision,
              value.release?.auditEventId ?? null,
              JSON.stringify(value),
              value.id,
              JSON.stringify(previous.snapshot),
            )
    try {
      const statements = [
        ...this.c.assertions,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        mutation,
        db.prepare(
          "SELECT CASE WHEN changes()=1 THEN 1 ELSE json_extract('{}','record_source_freeze_conflict') END",
        ),
        ...this.c.assertions,
      ]
      const results = await db.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? "written"
        : new Error("record source freeze write failed")
    } catch (cause) {
      if (
        cause instanceof Error &&
        /record_source_freeze_(creation_invalid|immutable|conflict)|record_source_already_retired/.test(
          cause.message,
        )
      )
        return "conflict"
      return new Error("record source freeze write failed", { cause })
    }
  }
}
