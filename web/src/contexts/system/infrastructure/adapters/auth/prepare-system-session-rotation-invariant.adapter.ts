import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import type { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"

type Props = Readonly<{
  database: D1Database
  rotation: SessionRotationValue
  audits: SessionRotationAuditEvents
}>

/** decision監査とrotation後のSession familyが同じ結果を示すことを検証する。 */
export class PrepareSystemSessionRotationInvariantAdapter {
  prepareSystemSessionRotationInvariant(props: Props): D1PreparedStatement {
    const previous = props.rotation.previous
    const successor = props.rotation.successor
    const rotatedAt = previous.rotatedAt?.getTime() ?? Number.NaN

    return props.database
      .prepare(
        `SELECT CASE WHEN
         (SELECT COUNT(*) FROM system_audit_events
          WHERE event_id IN (?1, ?2, ?3)) = 1
         AND CASE
           WHEN EXISTS (SELECT 1 FROM system_audit_events WHERE event_id = ?1) THEN
             EXISTS (
               SELECT 1 FROM system_sessions
               WHERE id = ?4 AND token_hash = ?5 AND account_id = ?6 AND family_id = ?7
                 AND token_version = ?8 AND created_at = ?9 AND expires_at = ?10
                 AND rotated_at = ?11 AND revoked_at IS NULL
             )
             AND EXISTS (
               SELECT 1 FROM system_sessions
               WHERE id = ?12 AND token_hash = ?13 AND account_id = ?14 AND family_id = ?15
                 AND token_version = ?16 AND created_at = ?17 AND expires_at = ?18
                 AND rotated_at IS NULL AND revoked_at IS NULL
             )
             AND (SELECT COUNT(*) FROM system_sessions
                  WHERE family_id = ?7 AND rotated_at IS NULL AND revoked_at IS NULL) = 1
           WHEN EXISTS (SELECT 1 FROM system_audit_events WHERE event_id IN (?2, ?3)) THEN
             NOT EXISTS (
               SELECT 1 FROM system_sessions WHERE family_id = ?7 AND revoked_at IS NULL
             )
           ELSE 0
         END
       THEN 1 ELSE json_extract('', '$') END AS ok`,
      )
      .bind(
        props.audits.rotated.eventId,
        props.audits.reused.eventId,
        props.audits.invalid.eventId,
        previous.id,
        previous.tokenHash,
        previous.accountId,
        previous.familyId,
        previous.tokenVersion,
        previous.createdAt.getTime(),
        previous.expiresAt.getTime(),
        rotatedAt,
        successor.id,
        successor.tokenHash,
        successor.accountId,
        successor.familyId,
        successor.tokenVersion,
        successor.createdAt.getTime(),
        successor.expiresAt.getTime(),
      )
  }
}
