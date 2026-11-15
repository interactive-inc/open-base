import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
/** 外側のsystem_sessionsをsessionと呼ぶSQLで使う。旧方式のbrowser由来familyは再認証を必要とする。 */
export const systemSessionFamilyEligibilitySql = `NOT EXISTS (
  SELECT 1 FROM system_sessions legacy
  JOIN system_audit_events provenance ON provenance.target_id = legacy.id
  WHERE legacy.family_id = session.family_id AND legacy.account_id = session.account_id
    AND provenance.target_type = 'session' AND provenance.action = '${SYSTEM_AUDIT_ACTIONS.authSessionCreate}'
    AND provenance.outcome = 'succeeded'
    AND json_extract(provenance.metadata_json, '$.transport') = 'system.browser-sessions'
    AND json_extract(provenance.metadata_json, '$.sourceSessionFamilyId') IS NOT legacy.family_id
)`

/** 正規のbrowser交換ごとに1本だけ並行する更新系列を許す。更新しても系列の本数は増やさない。 */
export const systemSessionFamilyCardinalitySql = `(
  SELECT COUNT(*) FROM system_sessions active
  WHERE active.family_id = session.family_id
    AND active.rotated_at IS NULL AND active.revoked_at IS NULL
) <= 1 + (
  SELECT COUNT(*) FROM system_sessions browser
  JOIN system_audit_events provenance ON provenance.target_id = browser.id
  WHERE browser.family_id = session.family_id AND browser.account_id = session.account_id
    AND provenance.target_type = 'session' AND provenance.action = '${SYSTEM_AUDIT_ACTIONS.authSessionCreate}'
    AND provenance.outcome = 'succeeded'
    AND json_extract(provenance.metadata_json, '$.transport') = 'system.browser-sessions'
    AND json_extract(provenance.metadata_json, '$.sourceSessionFamilyId') = browser.family_id
)`
