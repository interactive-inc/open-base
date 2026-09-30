import type { SystemD1Context } from "@system/configuration/system-context"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
const projection = `json_object('id', id, 'attachmentId', attachment_id, 'sha256', plaintext_sha256,
  'kind', kind, 'retainUntil', strftime('%Y-%m-%dT%H:%M:%fZ', retain_until / 1000.0, 'unixepoch'),
  'reason', reason, 'actorAccountId', created_by_account_id,
  'createdAt', strftime('%Y-%m-%dT%H:%M:%fZ', created_at / 1000.0, 'unixepoch'),
  'auditEventId', created_audit_event_id, 'revision', revision,
  'release', CASE WHEN released_at IS NULL THEN NULL ELSE json_object(
    'operationId', release_operation_id, 'reason', release_reason, 'actorAccountId', released_by_account_id,
    'at', strftime('%Y-%m-%dT%H:%M:%fZ', released_at / 1000.0, 'unixepoch'),
    'auditEventId', release_audit_event_id) END) AS snapshot_json`

/** 添付の保全を、現在の操作資格と監査の検査を含むtransactionへ保存する。 */
export class AttachmentPreservationRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(id: string): Promise<AttachmentPreservationEntity | null | Error> {
    const rows = await this.read(
      this.c.env.DB.prepare(
        `SELECT ${projection} FROM system_attachment_preservations WHERE id = ?1`,
      ).bind(id),
    )
    return rows instanceof Error ? rows : (rows.at(0) ?? null)
  }

  async findMany(
    attachmentId: string,
    afterId: string,
    limit: number,
  ): Promise<ReadonlyArray<AttachmentPreservationEntity> | Error> {
    return this.read(
      this.c.env.DB.prepare(`SELECT ${projection} FROM system_attachment_preservations
      WHERE attachment_id = ?1 AND id > ?2 ORDER BY id LIMIT ?3`).bind(
        attachmentId,
        afterId,
        limit,
      ),
    )
  }

  private async read(
    statement: D1PreparedStatement,
  ): Promise<ReadonlyArray<AttachmentPreservationEntity> | Error> {
    try {
      const batch = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...this.c.assertions,
        statement,
      ])
      if (batch.length !== this.c.assertions.length + 1 || batch.some((result) => !result.success))
        return new Error("preservation read failed")
      const entities: AttachmentPreservationEntity[] = []
      for (const row of batch.at(-1)?.results ?? []) {
        const entity = AttachmentPreservationEntity.create(JSON.parse(row.snapshot_json))
        if (entity instanceof Error)
          return new Error("stored preservation is invalid", { cause: entity })
        entities.push(entity)
      }
      return entities
    } catch (cause) {
      return new Error("preservation read failed", { cause })
    }
  }

  prepareWrite(
    entity: AttachmentPreservationEntity,
    audit: SystemAuditEventEntity,
  ): ReadonlyArray<D1PreparedStatement> {
    const value = entity.snapshot
    const release = value.release
    const statement =
      release === null
        ? this.c.env.DB.prepare(`INSERT INTO system_attachment_preservations
        (id, attachment_id, plaintext_sha256, kind, retain_until, reason, created_by_account_id, created_at, created_audit_event_id, revision)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)`).bind(
            value.id,
            value.attachmentId,
            value.sha256,
            value.kind,
            value.retainUntil === null ? null : Date.parse(value.retainUntil),
            value.reason,
            value.actorAccountId,
            Date.parse(value.createdAt),
            value.auditEventId,
          )
        : this.c.env.DB.prepare(`UPDATE system_attachment_preservations SET revision = 2,
        release_operation_id = ?2, released_by_account_id = ?3, released_at = ?4, release_reason = ?5,
        release_audit_event_id = ?6 WHERE id = ?1 AND revision = 1 AND kind = 'hold'`).bind(
            value.id,
            release.operationId,
            release.actorAccountId,
            Date.parse(release.at),
            release.reason,
            release.auditEventId,
          )
    return [
      ...this.c.assertions,
      ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      statement,
      // 同じ保全への同時の書込みに負けた時は、対象が見つからない失敗と区別して競合として扱う。
      this.c.env.DB.prepare(
        "SELECT CASE WHEN changes() = 0 THEN json_extract('{}', 'attachment_preservation_revision_changed') ELSE 1 END AS ok",
      ),
    ]
  }

  async write(
    entity: AttachmentPreservationEntity,
    audit: SystemAuditEventEntity,
  ): Promise<"written" | "conflict" | Error> {
    try {
      const statements = [...this.prepareWrite(entity, audit)]
      const results = await this.c.env.DB.batch(statements)
      return results.length === statements.length && results.every((result) => result.success)
        ? "written"
        : new Error("preservation write failed")
    } catch (cause) {
      if (
        cause instanceof Error &&
        /UNIQUE constraint failed|integer overflow|attachment_preservation_target_unavailable|attachment_preservation_revision_changed/.test(
          cause.message,
        )
      )
        return "conflict"
      return new Error("preservation write failed", { cause })
    }
  }
}
