import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import type { SystemAttachmentRow } from "@system/infrastructure/schema/system-attachment"

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
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
        WITH evaluation AS (SELECT max(?5, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at)
        SELECT 1 FROM system_accounts account
        LEFT JOIN system_principals principal ON principal.account_id = account.id
        LEFT JOIN system_machine_credentials credential
          ON credential.principal_id = principal.id AND credential.id = ?3
        LEFT JOIN system_identity_bindings identity ON identity.account_id=account.id AND identity.id=?6
        LEFT JOIN system_connectors connector ON connector.id = principal.connector_id
        WHERE account.id = ?1 AND account.status = 'active' AND account.closed_at IS NULL
          AND account.token_version = ?2 AND account.created_at <= ?5
          AND ?4 <= (SELECT at FROM evaluation) AND (SELECT at FROM evaluation) < ?7
          AND (?6 IS NULL OR (identity.id IS NOT NULL AND identity.revoked_at IS NULL
            AND identity.created_at <= (SELECT at FROM evaluation) AND identity.activated_at IS NOT NULL
            AND identity.activated_at <= (SELECT at FROM evaluation)))
          AND ((?3 IS NULL AND (principal.id IS NULL OR principal.kind = 'human'))
            OR (?3 IS NOT NULL AND principal.kind IN ('agent', 'service', 'connector')
              AND credential.status = 'active' AND credential.revoked_at IS NULL
              AND credential.created_at <= ?4 AND credential.created_at <= ?5
              AND credential.last_used_at >= ?4
              AND (credential.expires_at IS NULL OR (credential.expires_at > ?4 AND credential.expires_at > ?5))
              AND (principal.kind <> 'connector' OR connector.status = 'active')))
        ) THEN 1 ELSE json_extract('{}', 'attachment_read_actor_changed') END`).bind(
        authentication.accountId,
        authentication.tokenVersion,
        authentication.machineCredentialId ?? null,
        authentication.issuedAtMs,
        input.at.getTime(),
        authentication.identityBindingId,
        authentication.expiresAtMs,
      ),
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
