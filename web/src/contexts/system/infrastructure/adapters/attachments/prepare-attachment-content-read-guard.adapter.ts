import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"

type Context = SystemD1Context

/** 復号した内容・鍵・メタデータと紐付け状態を、開示監査のtransactionへ固定する。 */
export class PrepareAttachmentContentReadGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    attachment: SystemAttachmentRow,
    at: Date,
    expectedStatus: "pending" | "linked" = "linked",
  ): D1PreparedStatement {
    return this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_attachments WHERE id = ?1 AND owner_account_id = ?2 AND object_key = ?3
        AND status = ?15 AND ?16 = ?15 AND file_name = ?4 AND content_type = ?5 AND byte_size = ?6
        AND plaintext_sha256 = ?7 AND wrapped_dek = ?8 AND wrapped_dek_iv = ?9 AND content_iv = ?10
        AND kek_version = ?11 AND created_at = ?12 AND created_at <= ?14
        AND ((?15 = 'linked' AND linked_at = ?13 AND linked_at <= ?14)
          OR (?15 = 'pending' AND linked_at IS NULL)) AND erased_at IS NULL
    ) THEN 1 ELSE json_extract('{}','attachment_read_content_changed') END`).bind(
      attachment.id,
      attachment.ownerAccountId,
      attachment.objectKey,
      attachment.fileName,
      attachment.contentType,
      attachment.byteSize,
      attachment.plaintextSha256,
      attachment.wrappedDek,
      attachment.wrappedDekIv,
      attachment.contentIv,
      attachment.kekVersion,
      attachment.createdAt.getTime(),
      attachment.linkedAt?.getTime() ?? null,
      at.getTime(),
      expectedStatus,
      attachment.status,
    )
  }
}
