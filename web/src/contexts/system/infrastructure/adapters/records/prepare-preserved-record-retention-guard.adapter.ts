import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 承認された本文の保持条件が未解除・有効であることを、照合確定時にも検査する。 */
export class PreparePreservedRecordRetentionGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(record: PreservedRecordEntity, at: Date) {
    if (this.c.assertions.length === 0)
      return new Error("retention verification authorization required")
    const preservation = await new AttachmentPreservationRepository(this.c).find(
      record.snapshot.preservationId,
    )
    if (preservation instanceof Error) return preservation
    if (preservation === null || !record.matchesPreservation(preservation))
      return new Error("approved record preservation is not active")
    const value = preservation.snapshot
    if (value.retainUntil !== null && Date.parse(value.retainUntil) <= at.getTime())
      return new Error("approved record retention expired")
    const guard = this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?1,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
    ) SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_attachment_preservations WHERE id=?2 AND attachment_id=?3
        AND plaintext_sha256=?4 AND created_audit_event_id=?5 AND created_by_account_id=?6 AND created_at=?7
        AND kind=?8 AND retain_until IS ?9 AND revision=1 AND released_at IS NULL
        AND created_at <= (SELECT at FROM evaluation)
        AND (kind='hold' OR retain_until > (SELECT at FROM evaluation))
    ) THEN 1 ELSE json_extract('{}','record_retention_changed') END`).bind(
      at.getTime(),
      value.id,
      value.attachmentId,
      value.sha256,
      value.auditEventId,
      value.actorAccountId,
      Date.parse(value.createdAt),
      value.kind,
      value.retainUntil === null ? null : Date.parse(value.retainUntil),
    )
    try {
      const statements = [...this.c.assertions, guard]
      const checked = await this.c.env.DB.batch(statements)
      if (checked.length !== statements.length || checked.some((result) => !result.success))
        return new Error("approved record retention unavailable")
      return Object.freeze({ preservation: value, assertions: Object.freeze(statements) })
    } catch (cause) {
      return new Error("approved record retention unavailable", { cause })
    }
  }
}
