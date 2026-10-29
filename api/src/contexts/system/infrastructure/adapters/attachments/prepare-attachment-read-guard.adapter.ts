import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"
import { PrepareAttachmentActorGuardAdapter } from "@system/infrastructure/adapters/attachments/prepare-attachment-actor-guard.adapter"

type Context = SystemD1Context

/** 閲覧監査と同じtransactionで、認証状態と復号した添付の版を照合する。 */
export class PrepareAttachmentReadGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    input: Readonly<{
      attachment: SystemAttachmentRow
      authentication: SystemReadAuthentication
      at: Date
    }>,
  ): ReadonlyArray<D1PreparedStatement> {
    const row = input.attachment
    const authentication = input.authentication

    return [
      ...new PrepareAttachmentActorGuardAdapter(this.c).prepare({
        authentication,
        at: input.at,
        rejection: "attachment_read_actor_changed",
      }),
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        SELECT 1 FROM system_attachments WHERE id = ?1 AND owner_account_id = ?2
          AND status = ?3 AND status IN ('uploading', 'pending')
          AND plaintext_sha256 = ?4 AND file_name = ?5 AND content_type = ?6 AND byte_size = ?7
          AND object_key = ?8 AND wrapped_dek = ?9 AND wrapped_dek_iv = ?10 AND content_iv = ?11
          AND kek_version = ?12 AND created_at = ?13 AND created_at <= ?14
          AND linked_at IS NULL AND erased_at IS NULL
        ) THEN 1 ELSE json_extract('{}', 'attachment_read_target_changed') END`).bind(
        row.id,
        authentication.accountId,
        row.status,
        row.plaintextSha256,
        row.fileName,
        row.contentType,
        row.byteSize,
        row.objectKey,
        row.wrappedDek,
        row.wrappedDekIv,
        row.contentIv,
        row.kekVersion,
        row.createdAt.getTime(),
        input.at.getTime(),
      ),
    ]
  }

  static rejection(cause: unknown): "actor" | "target" | null {
    const visited = new Set<Error>()

    for (let error = cause; error instanceof Error && !visited.has(error); error = error.cause) {
      if (
        /(?:bad JSON path:|JSON path error near)\s*['"]attachment_read_actor_changed['"]/i.test(
          error.message,
        )
      )
        return "actor"
      if (
        /(?:bad JSON path:|JSON path error near)\s*['"]attachment_read_target_changed['"]/i.test(
          error.message,
        )
      )
        return "target"
      visited.add(error)
    }

    return null
  }
}
