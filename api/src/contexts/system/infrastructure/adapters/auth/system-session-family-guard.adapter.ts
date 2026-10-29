import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"

type Context = SystemD1Context

/** family付きBearerのlogoutを、保存・開示と同じtransactionで再照合する。 */
export class SystemSessionFamilyGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    input: Readonly<{
      authentication: SystemReadAuthentication
      at: Date
      rejection:
        | "system_read_authorization_changed"
        | "attachment_read_actor_changed"
        | "work_item_authorization_changed"
    }>,
  ): ReadonlyArray<D1PreparedStatement> {
    if (input.authentication.sessionFamilyId === null) return []

    return [
      this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_sessions WHERE family_id=?1 AND account_id=?2
        AND (revoked_at IS NULL OR revoked_at>max(?3,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)))
      ) THEN 1 ELSE json_extract('{}',?4) END`).bind(
        input.authentication.sessionFamilyId,
        input.authentication.accountId,
        input.at.getTime(),
        input.rejection,
      ),
    ]
  }
}
