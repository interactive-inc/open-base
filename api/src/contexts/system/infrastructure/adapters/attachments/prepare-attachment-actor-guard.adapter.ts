import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { SystemSessionFamilyGuardAdapter } from "@system/infrastructure/adapters/auth/system-session-family-guard.adapter"

type Context = SystemD1Context

/** 添付の保存・開示と同じtransactionで、検証済みBearerの発行元と期限を再照合する。 */
export class PrepareAttachmentActorGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }
  prepare(
    input: Readonly<{
      authentication: SystemReadAuthentication
      at: Date
      rejection: "attachment_read_actor_changed" | "attachment_upload_actor_changed"
    }>,
  ): ReadonlyArray<D1PreparedStatement> {
    const authentication = input.authentication
    return [
      ...new SystemSessionFamilyGuardAdapter(this.c).prepare({
        authentication,
        at: input.at,
        rejection: input.rejection,
      }),
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
              AND (credential.expires_at IS NULL OR (credential.expires_at > ?4 AND credential.expires_at > (SELECT at FROM evaluation)))
              AND (principal.kind <> 'connector' OR connector.status = 'active')))
        ) THEN 1 ELSE json_extract('{}', ?8) END`).bind(
        authentication.accountId,
        authentication.tokenVersion,
        authentication.machineCredentialId ?? null,
        authentication.issuedAtMs,
        input.at.getTime(),
        authentication.identityBindingId,
        authentication.expiresAtMs,
        input.rejection,
      ),
    ]
  }
  static isUploadRejected(cause: unknown): boolean {
    const visited = new Set<Error>()
    for (let error = cause; error instanceof Error && !visited.has(error); error = error.cause) {
      if ("code" in error && error.code === "attachment_upload_actor_changed") return true
      if (
        /(?:bad JSON path:|JSON path error near)\s*['"]attachment_upload_actor_changed['"]/i.test(
          error.message,
        )
      )
        return true
      visited.add(error)
    }
    return false
  }
}
