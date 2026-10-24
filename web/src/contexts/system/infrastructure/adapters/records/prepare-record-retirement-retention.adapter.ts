import type { SystemD1Context } from "@system/configuration/system-context"
import { PrepareRecordRetirementCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-coverage.adapter"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 全検査ページの保全先について元の承認済み保持を再検査する。原記録や開示資格の検査は行わない。 */
export class PrepareRecordRetirementRetentionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown, at: Date) {
    if (!Number.isSafeInteger(at.getTime()) || at.getTime() < 0)
      return new Error("retirement retention time invalid")
    const coverage = await new PrepareRecordRetirementCoverageAdapter(this.c).prepare(input)
    if (coverage instanceof Error) return coverage
    const guard = this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?2,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
    ) SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM system_record_retirement_plans plan
      JOIN json_each(plan.snapshot_json,'$.coverage') kind
      JOIN system_record_coverage_entries entry ON entry.freeze_id=plan.freeze_id
        AND entry.record_kind IS json_extract(kind.value,'$.recordKind')
      LEFT JOIN system_preserved_records record ON record.id=entry.preserved_record_id
      LEFT JOIN system_attachment_preservations hold ON hold.id=record.preservation_id
      LEFT JOIN system_attachments attachment ON attachment.id=record.attachment_id
      WHERE plan.id=?1 AND (
        record.id IS NULL OR hold.id IS NULL OR attachment.id IS NULL
        OR hold.attachment_id IS NOT record.attachment_id
        OR hold.plaintext_sha256 IS NOT json_extract(record.snapshot_json,'$.attachmentDigest')
        OR hold.created_by_account_id IS NOT json_extract(record.snapshot_json,'$.actorAccountId')
        OR strftime('%Y-%m-%dT%H:%M:%fZ',hold.created_at/1000.0,'unixepoch') IS NOT json_extract(record.snapshot_json,'$.finalizedAt')
        OR hold.revision<>1 OR hold.released_at IS NOT NULL OR hold.created_at>(SELECT at FROM evaluation)
        OR (hold.kind<>'hold' AND (hold.retain_until IS NULL OR hold.retain_until<=(SELECT at FROM evaluation)))
        OR attachment.status<>'linked' OR attachment.erased_at IS NOT NULL
        OR attachment.wrapped_dek IS NULL OR attachment.wrapped_dek_iv IS NULL
        OR attachment.plaintext_sha256 IS NOT hold.plaintext_sha256
      )
    ) THEN 1 ELSE json_extract('{}','record_retirement_retention_changed') END`).bind(
      coverage.planId,
      at.getTime(),
    )
    const assertions = Object.freeze([...coverage.assertions, guard])
    try {
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement retention unavailable")
      return Object.freeze({ coverage, assertions })
    } catch (cause) {
      return new Error("retirement retention unavailable", { cause })
    }
  }
}
