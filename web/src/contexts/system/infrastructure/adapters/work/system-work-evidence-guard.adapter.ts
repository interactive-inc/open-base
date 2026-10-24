import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { SystemWorkItemError } from "@system/domain/errors"

type Context = SystemD1Context

/** 復号した証拠の全メタデータと作業への紐付けを、開示監査と同じtransactionで照合する。 */
export class SystemWorkEvidenceGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async verify(
    statements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<SystemWorkItemError | null> {
    try {
      const checked = await this.c.env.DB.batch([...statements])
      if (checked.length !== statements.length || checked.some((item) => !item.success))
        return new SystemWorkItemError("unavailable")
      return null
    } catch (cause) {
      if (cause instanceof Error && /work_item_(read|evidence)_changed/.test(cause.message))
        return new SystemWorkItemError("not_found", cause)
      return new SystemWorkItemError("unavailable", cause)
    }
  }

  prepare(
    input: Readonly<{ workItemId: string; attachment: SystemAttachmentRow; now: Date }>,
  ): D1PreparedStatement {
    const row = input.attachment
    return this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_attachments attachment JOIN system_work_evidence claim ON claim.attachment_id=attachment.id
      WHERE claim.work_item_id=?1 AND claim.plaintext_sha256=?2 AND attachment.id=?3 AND attachment.owner_account_id=?4
        AND attachment.status='linked' AND attachment.plaintext_sha256=?2 AND attachment.file_name=?5
        AND attachment.content_type=?6 AND attachment.byte_size=?7 AND attachment.object_key=?8
        AND attachment.wrapped_dek=?9 AND attachment.wrapped_dek_iv=?10 AND attachment.content_iv=?11
        AND attachment.kek_version=?12 AND attachment.created_at=?13 AND attachment.created_at<=?15
        AND attachment.linked_at=?14 AND attachment.linked_at<=?15 AND attachment.erased_at IS NULL)
      THEN 1 ELSE json_extract('{}','work_item_evidence_changed') END AS ok`).bind(
      input.workItemId,
      row.plaintextSha256,
      row.id,
      row.ownerAccountId,
      row.fileName,
      row.contentType,
      row.byteSize,
      row.objectKey,
      row.wrappedDek,
      row.wrappedDekIv,
      row.contentIv,
      row.kekVersion,
      row.createdAt.getTime(),
      row.linkedAt?.getTime() ?? null,
      input.now.getTime(),
    )
  }
}
