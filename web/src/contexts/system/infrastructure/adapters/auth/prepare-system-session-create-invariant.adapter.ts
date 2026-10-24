import type { SessionEntity } from "@system/domain/entities/session.entity"
type PrepareSystemSessionCreateInvariantAdapterContext = D1Database
type Context = PrepareSystemSessionCreateInvariantAdapterContext

/** SessionEntity発行後のrowがDomain入力と完全一致することをtransaction内で検証する。 */
export class PrepareSystemSessionCreateInvariantAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepareSystemSessionCreateInvariant(session: SessionEntity): D1PreparedStatement {
    return this.c
      .prepare(
        `SELECT CASE WHEN EXISTS (
         SELECT 1
         FROM system_sessions
         WHERE id = ?1
           AND account_id = ?2
           AND family_id = ?3
           AND token_hash = ?4
           AND token_version = ?5
           AND created_at = ?6
           AND expires_at = ?7
           AND rotated_at IS ?8
           AND revoked_at IS ?9
       ) THEN 1 ELSE json_extract('', '$') END AS ok`,
      )
      .bind(
        session.id,
        session.accountId,
        session.familyId,
        session.tokenHash,
        session.tokenVersion,
        session.createdAt.getTime(),
        session.expiresAt.getTime(),
        session.rotatedAt?.getTime() ?? null,
        session.revokedAt?.getTime() ?? null,
      )
  }
}
