import type { SystemD1Context } from "@system/configuration/system-context"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 保全記録の開示設定と監査を同時に保存し、最新の設定を取得する。 */
export class PreservedRecordDisclosurePolicyRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  preparePublish(
    entity: PreservedRecordDisclosurePolicyEntity,
    audit: SystemAuditEventEntity,
  ): ReadonlyArray<D1PreparedStatement> {
    const value = entity.snapshot
    return [
      ...this.c.assertions,
      ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      this.c.env.DB.prepare(`INSERT INTO system_record_disclosure_policies
        (revision_id, id, revision, record_id, audit_event_id, snapshot_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`).bind(
        crypto.randomUUID(),
        value.id,
        value.revision,
        value.recordId,
        value.auditEventId,
        JSON.stringify(value),
      ),
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
    ]
  }

  prepareDisclosureGuard(
    entity: PreservedRecordDisclosurePolicyEntity,
    request: unknown,
  ): ReadonlyArray<D1PreparedStatement> | Error {
    if (!entity.permits(request)) return new Error("record disclosure is not permitted")
    return [
      ...this.c.assertions,
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM system_record_disclosure_policies p
        WHERE p.id = ?1 AND p.revision = ?2 AND p.snapshot_json = ?3
          AND NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies newer WHERE newer.id = p.id AND newer.revision > p.revision)
      ) THEN 1 ELSE json_extract('', '$') END`).bind(
        entity.snapshot.id,
        entity.snapshot.revision,
        JSON.stringify(entity.snapshot),
      ),
    ]
  }

  async findCurrent(id: string): Promise<PreservedRecordDisclosurePolicyEntity | null | Error> {
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(
          "SELECT snapshot_json FROM system_record_disclosure_policies WHERE id = ?1 ORDER BY revision DESC LIMIT 1",
        ).bind(id),
      ]
      const batch = await this.c.env.DB.batch<{ snapshot_json: string }>(statements)
      if (batch.length !== statements.length || batch.some((result) => !result.success))
        return new Error("record disclosure read failed")
      const row = batch.at(-1)?.results.at(0)
      if (!row) return null
      const entity = PreservedRecordDisclosurePolicyEntity.create(JSON.parse(row.snapshot_json))
      return entity instanceof Error
        ? new Error("stored record disclosure is invalid", { cause: entity })
        : entity
    } catch (cause) {
      return new Error("record disclosure read failed", { cause })
    }
  }
}
