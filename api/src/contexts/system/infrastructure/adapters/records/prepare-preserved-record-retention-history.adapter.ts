import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
const snapshotSql = `SELECT json_group_array(json_array(id, attachment_id, plaintext_sha256,
  kind, retain_until, reason, created_by_account_id, created_at, created_audit_event_id, revision,
  release_operation_id, released_by_account_id, released_at, release_reason, release_audit_event_id)) AS snapshot
  FROM (SELECT * FROM system_attachment_preservations WHERE attachment_id = ?1 ORDER BY id)`

/** 同じ原文への全保全・解除を取得し、取得中の追加や解除を最終transactionで検知する。 */
export class PreparePreservedRecordRetentionHistoryAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(record: PreservedRecordEntity) {
    if (this.c.assertions.length === 0)
      return new Error("retention history authorization is required")
    try {
      const attachmentId = record.snapshot.attachmentId
      const batches = await this.c.env.DB.batch<{ snapshot: string }>([
        ...this.c.assertions,
        this.c.env.DB.prepare(snapshotSql).bind(attachmentId),
      ])
      if (
        batches.length !== this.c.assertions.length + 1 ||
        batches.some((batch) => !batch.success)
      )
        return new Error("retention history snapshot unavailable")
      const snapshot = batches.at(-1)?.results.at(0)?.snapshot
      if (typeof snapshot !== "string") return new Error("retention history snapshot unavailable")
      const preservations: AttachmentPreservationEntity[] = []
      const reader = new AttachmentPreservationRepository(this.c)
      while (true) {
        const page = await reader.findMany(
          attachmentId,
          preservations.at(-1)?.snapshot.id ?? "",
          100,
        )
        if (page instanceof Error) return page
        for (const preservation of page) {
          if (
            preservation.snapshot.attachmentId !== attachmentId ||
            preservation.snapshot.sha256 !== record.snapshot.attachmentDigest
          )
            return new Error("retention history belongs to different content")
          preservations.push(preservation)
        }
        if (page.length < 100) break
      }
      const original = preservations.find(
        (preservation) => preservation.snapshot.id === record.snapshot.preservationId,
      )
      if (
        original === undefined ||
        original.snapshot.createdAt !== record.snapshot.finalizedAt ||
        original.snapshot.actorAccountId !== record.snapshot.actorAccountId
      )
        return new Error("original retention history is missing")
      // 人の現在の保全参照資格を再検査し、開示監査と同じtransactionでguardを実行してから返す。
      return Object.freeze({
        preservations: Object.freeze(preservations.map((preservation) => preservation.snapshot)),
        guard: this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
          SELECT 1 FROM (${snapshotSql}) current WHERE current.snapshot = ?2
        ) THEN 1 ELSE json_extract('{}', 'record_retention_history_changed') END`).bind(
          attachmentId,
          snapshot,
        ),
      })
    } catch (cause) {
      return new Error("retention history unavailable", { cause })
    }
  }
}
