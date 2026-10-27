import type { SessionRotationAuditEvents } from "@system/domain/definitions/auth/session-rotation-audit-events.definition"
import type { SessionRotationValue } from "@system/domain/values/auth/session-rotation.value"

type Props = Readonly<{
  database: D1Database
  rotation: SessionRotationValue
  audits: SessionRotationAuditEvents
}>

/** transaction開始時の永続状態からrotation decisionを一度だけ監査行へ固定する。 */
export class PrepareSystemSessionRotationAuditAdapter {
  prepareSystemSessionRotationAudit(props: Props): D1PreparedStatement {
    const previous = props.rotation.previous
    const rotatedAt = previous.rotatedAt?.getTime() ?? Number.NaN
    const rotated = props.audits.rotated
    const reused = props.audits.reused
    const invalid = props.audits.invalid

    return props.database
      .prepare(
        `WITH rotation_decision(value) AS (
         SELECT COALESCE((
           SELECT CASE
             WHEN session.rotated_at IS NOT NULL OR session.revoked_at IS NOT NULL THEN 'reused'
             WHEN session.created_at > ?8 OR session.expires_at <= ?8 THEN 'invalid'
             WHEN account.id IS NULL
               OR account.status <> 'active'
               OR account.token_version <> session.token_version
             THEN 'invalid'
             WHEN (
               SELECT COUNT(*)
               FROM system_sessions AS active_session
               WHERE active_session.family_id = session.family_id
                 AND active_session.rotated_at IS NULL
                 AND active_session.revoked_at IS NULL
             ) <> 1
             THEN 'invalid'
             ELSE 'rotated'
           END
           FROM system_sessions AS session
           LEFT JOIN system_accounts AS account ON account.id = session.account_id
           WHERE session.id = ?1
             AND session.token_hash = ?2
             AND session.account_id = ?3
             AND session.family_id = ?4
             AND session.token_version = ?5
             AND session.created_at = ?6
             AND session.expires_at = ?7
         ), 'invalid')
       )
       INSERT INTO system_audit_events
         (event_id, actor_account_id, action, target_type, target_id, outcome, reason_code,
          authorization_json, before_json, after_json, metadata_json, occurred_at)
       SELECT ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20
       FROM rotation_decision WHERE value = 'rotated'
       UNION ALL
       SELECT ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31, ?32
       FROM rotation_decision WHERE value = 'reused'
       UNION ALL
       SELECT ?33, ?34, ?35, ?36, ?37, ?38, ?39, ?40, ?41, ?42, ?43, ?44
       FROM rotation_decision WHERE value = 'invalid'
       RETURNING event_id`,
      )
      .bind(
        previous.id,
        previous.tokenHash,
        previous.accountId,
        previous.familyId,
        previous.tokenVersion,
        previous.createdAt.getTime(),
        previous.expiresAt.getTime(),
        rotatedAt,
        rotated.eventId,
        rotated.actorAccountId,
        rotated.action,
        rotated.targetType,
        rotated.targetId,
        rotated.outcome,
        rotated.reasonCode,
        rotated.authorizationJson,
        rotated.beforeJson,
        rotated.afterJson,
        rotated.metadataJson,
        rotated.occurredAtEpochMilliseconds,
        reused.eventId,
        reused.actorAccountId,
        reused.action,
        reused.targetType,
        reused.targetId,
        reused.outcome,
        reused.reasonCode,
        reused.authorizationJson,
        reused.beforeJson,
        reused.afterJson,
        reused.metadataJson,
        reused.occurredAtEpochMilliseconds,
        invalid.eventId,
        invalid.actorAccountId,
        invalid.action,
        invalid.targetType,
        invalid.targetId,
        invalid.outcome,
        invalid.reasonCode,
        invalid.authorizationJson,
        invalid.beforeJson,
        invalid.afterJson,
        invalid.metadataJson,
        invalid.occurredAtEpochMilliseconds,
      )
  }
}
