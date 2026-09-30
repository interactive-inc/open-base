import { RecordPreservationProposalValue } from "@system/domain/values/records/record-preservation-proposal.value"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import type { SystemD1Context } from "@system/configuration/system-context"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 保全済み本文を確定記録へ結び、監査と同じtransactionに保存する。 */
export class PreservedRecordRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareFinalize(
    entity: PreservedRecordEntity,
    audit: SystemAuditEventEntity,
    verifiedAttachment: SystemAttachmentRow,
  ): ReadonlyArray<D1PreparedStatement> {
    const value = entity.snapshot
    const db = this.c.env.DB
    return [
      ...this.c.assertions,
      db
        .prepare(`UPDATE system_attachments SET status = 'linked', linked_at = ?1
        WHERE id = ?2 AND status = 'pending' AND owner_account_id = ?3
          AND plaintext_sha256 = ?4 AND content_type IN ('application/vnd.record-preservation+json', 'application/vnd.record-preservation+binary')
          AND wrapped_dek IS NOT NULL AND created_at <= ?1
          AND id = ?5 AND owner_account_id = ?6 AND object_key = ?7
          AND file_name = ?8 AND content_type = ?9 AND byte_size = ?10
          AND plaintext_sha256 = ?11 AND wrapped_dek = ?12 AND wrapped_dek_iv = ?13
          AND content_iv = ?14 AND kek_version = ?15 AND created_at = ?16
          AND linked_at IS NULL AND erased_at IS NULL AND ?17 = 'pending'`)
        .bind(
          Date.parse(value.finalizedAt),
          value.attachmentId,
          value.actorAccountId,
          value.attachmentDigest,
          verifiedAttachment.id,
          verifiedAttachment.ownerAccountId,
          verifiedAttachment.objectKey,
          verifiedAttachment.fileName,
          verifiedAttachment.contentType,
          verifiedAttachment.byteSize,
          verifiedAttachment.plaintextSha256,
          verifiedAttachment.wrappedDek,
          verifiedAttachment.wrappedDekIv,
          verifiedAttachment.contentIv,
          verifiedAttachment.kekVersion,
          verifiedAttachment.createdAt.getTime(),
          verifiedAttachment.status,
        ),
      abortWhenPreviousStatementChangedNoRows(db),
      ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      db
        .prepare(`INSERT INTO system_preserved_records
        (id, attachment_id, preservation_id, disclosure_policy_id, disclosure_policy_revision, audit_event_id, snapshot_json)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`)
        .bind(
          value.id,
          value.attachmentId,
          value.preservationId,
          value.disclosurePolicyId,
          value.disclosurePolicyRevision,
          value.auditEventId,
          JSON.stringify(value),
        ),
      abortWhenPreviousStatementChangedNoRows(db),
    ]
  }

  async findMatchingFinalization(
    record: PreservedRecordEntity,
    disclosure: PreservedRecordDisclosurePolicyEntity,
    preservation: AttachmentPreservationEntity,
  ): Promise<PreservedRecordEntity | null | Error> {
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(`SELECT r.snapshot_json,
        p.snapshot_json AS disclosure_json, a.after_json AS preservation_json
        FROM system_preserved_records r
        LEFT JOIN system_record_disclosure_policies p ON p.id = r.disclosure_policy_id AND p.revision = r.disclosure_policy_revision
        LEFT JOIN system_attachment_preservations h ON h.id = r.preservation_id
        LEFT JOIN system_audit_events a ON a.event_id = h.created_audit_event_id
        WHERE r.id = ?1`).bind(record.snapshot.id),
      ]
      const batch = await this.c.env.DB.batch<{
        snapshot_json: string
        disclosure_json: string | null
        preservation_json: string | null
      }>(statements)
      if (batch.length !== statements.length || batch.some((result) => !result.success))
        return new Error("record finalization lookup failed")
      const row = batch.at(-1)?.results.at(0)
      if (!row) return null
      const storedRecord = PreservedRecordEntity.create(JSON.parse(row.snapshot_json))
      const storedDisclosure = PreservedRecordDisclosurePolicyEntity.create(
        JSON.parse(row.disclosure_json ?? "null"),
      )
      const storedPreservation = AttachmentPreservationEntity.create(
        JSON.parse(row.preservation_json ?? "null"),
      )
      if (
        storedRecord instanceof Error ||
        storedDisclosure instanceof Error ||
        storedPreservation instanceof Error
      )
        return new Error("stored record finalization is invalid")
      const storedProposal = await RecordPreservationProposalValue.create({
        record: storedRecord,
        disclosure: storedDisclosure,
        preservation: storedPreservation,
      })
      const requestedProposal = await RecordPreservationProposalValue.create({
        record,
        disclosure,
        preservation,
      })
      if (
        storedProposal instanceof Error ||
        requestedProposal instanceof Error ||
        !storedProposal.props.digest.equals(requestedProposal.props.digest)
      )
        return new Error("record finalization conflicts with existing receipt")
      return storedRecord
    } catch (cause) {
      return new Error("record finalization lookup failed", { cause })
    }
  }

  async find(id: string): Promise<PreservedRecordEntity | null | Error> {
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(
          "SELECT snapshot_json FROM system_preserved_records WHERE id = ?1",
        ).bind(id),
      ]
      const batch = await this.c.env.DB.batch<{ snapshot_json: string }>(statements)
      if (batch.length !== statements.length || batch.some((result) => !result.success))
        return new Error("preserved record read failed")
      const row = batch.at(-1)?.results.at(0)
      if (!row) return null
      const entity = PreservedRecordEntity.create(JSON.parse(row.snapshot_json))
      return entity instanceof Error
        ? new Error("stored preserved record is invalid", { cause: entity })
        : entity
    } catch (cause) {
      return new Error("preserved record read failed", { cause })
    }
  }
}
