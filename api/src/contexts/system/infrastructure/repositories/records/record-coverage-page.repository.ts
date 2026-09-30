import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordCoveragePageEntity } from "@system/domain/entities/record-coverage-page.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 照合ページを監査・明細と同じtransactionへ追加し、末尾から分割処理を再開する。 */
export class RecordCoveragePageRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  findLatest(input: Readonly<{ freezeId: string; recordKind: string }>) {
    return this.read(
      this.c.env.DB.prepare(`SELECT snapshot_json,digest FROM system_record_coverage_pages
      WHERE freeze_id=?1 AND record_kind=?2 ORDER BY sequence DESC LIMIT 1`).bind(
        input.freezeId,
        input.recordKind,
      ),
    )
  }

  find(id: string | Readonly<{ freezeId: string; recordKind: string; sequence: number }>) {
    if (typeof id !== "string")
      return this.read(
        this.c.env.DB.prepare(`SELECT snapshot_json,digest FROM system_record_coverage_pages
          WHERE freeze_id=?1 AND record_kind=?2 AND sequence=?3`).bind(
          id.freezeId,
          id.recordKind,
          id.sequence,
        ),
      )
    return this.read(
      this.c.env.DB.prepare(
        "SELECT snapshot_json,digest FROM system_record_coverage_pages WHERE id=?1",
      ).bind(id),
    )
  }

  async append(
    page: RecordCoveragePageEntity,
    audit: SystemAuditEventEntity,
  ): Promise<"written" | "conflict" | Error> {
    if (this.c.assertions.length === 0) return new Error("coverage authorization required")
    const value = page.snapshot
    try {
      const statements = [
        ...this.c.assertions,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        this.c.env.DB.prepare(`INSERT INTO system_record_coverage_pages
          (id,freeze_id,record_kind,sequence,digest,previous_digest,after_cursor,next_cursor,audit_event_id,snapshot_json)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`).bind(
          value.id,
          value.freezeId,
          value.recordKind,
          value.sequence,
          page.digest,
          value.previousDigest,
          value.afterCursor,
          value.nextCursor,
          audit.eventId,
          JSON.stringify(value),
        ),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("coverage page append failed")
      return "written"
    } catch (cause) {
      if (
        cause instanceof Error &&
        /record_coverage_(page_conflict|page_gap|entry_duplicate)/.test(cause.message)
      )
        return "conflict"
      return new Error("coverage page append failed", { cause })
    }
  }

  private async read(query: D1PreparedStatement): Promise<RecordCoveragePageEntity | null | Error> {
    if (this.c.assertions.length === 0) return new Error("coverage authorization required")
    try {
      const statements = [...this.c.assertions, query, ...this.c.assertions]
      const results = await this.c.env.DB.batch<{ snapshot_json: string; digest: string }>(
        statements,
      )
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("coverage page read failed")
      const row = results[this.c.assertions.length]?.results[0]
      if (row === undefined) return null
      return RecordCoveragePageEntity.restore(JSON.parse(row.snapshot_json), row.digest)
    } catch (cause) {
      return new Error("coverage page read failed", { cause })
    }
  }
}
