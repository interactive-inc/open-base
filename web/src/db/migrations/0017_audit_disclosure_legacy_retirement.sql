-- 旧識別子の設定は、対応する新設定と監査記録を追記した場合にだけ解除できる。
-- 過去の設定・監査本文と、新しい設定の検証条件は変更しない。
DROP TRIGGER IF EXISTS system_audit_disclosure_revision_insert;
--> statement-breakpoint
CREATE TRIGGER system_audit_disclosure_revision_insert
BEFORE INSERT ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit_disclosure_revision_conflict')
  WHERE NEW.revision <> 1 + COALESCE((SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0)
    OR NEW.recorded_at < COALESCE((SELECT MAX(recorded_at) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0);
  SELECT RAISE(ABORT, 'audit_disclosure_scope_unavailable')
  WHERE NEW.scope <> '*' AND NOT EXISTS (SELECT 1 FROM system_accounts WHERE id = NEW.scope)
    AND NOT EXISTS (
      SELECT 1 FROM system_accounts owner
      JOIN system_audit_disclosure_policy_revisions replacement ON replacement.scope = owner.id
      JOIN system_audit_events replacement_audit ON replacement_audit.event_id = replacement.audit_event_id
      JOIN system_audit_events retirement_audit ON retirement_audit.event_id = NEW.audit_event_id
      WHERE owner.legacy_id = NEW.scope AND owner.id <> NEW.scope AND NEW.enabled = 0
        AND replacement.audit_event_id = json_extract(retirement_audit.after_json, '$.supersededByAuditEventId')
        AND json_extract(replacement_audit.after_json, '$.supersedesLegacyRevision') = NEW.revision - 1
        AND replacement.actor_account_id = NEW.actor_account_id AND replacement.recorded_at = NEW.recorded_at
        AND replacement.revision = (SELECT MAX(latest.revision)
          FROM system_audit_disclosure_policy_revisions latest WHERE latest.scope = owner.id)
    );
  SELECT RAISE(ABORT, 'audit_disclosure_fields_invalid')
  WHERE json_array_length(NEW.allowed_fields_json) > 7
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_fields_json) WHERE type <> 'text' OR value NOT IN ('actor_account_id', 'target_id', 'reason_code', 'authorization_json', 'before_json', 'after_json', 'metadata_json'))
    OR (SELECT COUNT(*) FROM json_each(NEW.allowed_fields_json)) <> (SELECT COUNT(DISTINCT value) FROM json_each(NEW.allowed_fields_json));
  SELECT RAISE(ABORT, 'audit_disclosure_labels_invalid')
  WHERE json_array_length(NEW.allowed_target_types_json) > 64 OR json_array_length(NEW.allowed_purposes_json) > 64
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_target_types_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100)
    OR EXISTS (SELECT 1 FROM json_each(NEW.allowed_purposes_json) WHERE type <> 'text' OR length(trim(value)) NOT BETWEEN 1 AND 100);
  SELECT RAISE(ABORT, 'audit_disclosure_audit_mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events audit
    WHERE audit.event_id = NEW.audit_event_id AND audit.actor_account_id = NEW.actor_account_id
      AND audit.action = 'system.audit.disclosure.published' AND audit.target_type = 'system:audit-disclosure-policy'
      AND audit.target_id = NEW.scope AND audit.outcome = 'succeeded' AND audit.occurred_at = NEW.recorded_at
      AND json_extract(audit.after_json, '$.scope') IS NEW.scope
      AND json_extract(audit.after_json, '$.revision') IS NEW.revision
      AND json_extract(audit.after_json, '$.commandId') IS NEW.command_id
      AND json_extract(audit.after_json, '$.enabled') IS NEW.enabled
      AND json_extract(audit.after_json, '$.allowedFields') IS NEW.allowed_fields_json
      AND json_extract(audit.after_json, '$.allowedTargetTypes') IS NEW.allowed_target_types_json
      AND json_extract(audit.after_json, '$.allowedPurposes') IS NEW.allowed_purposes_json
      AND json_extract(audit.after_json, '$.expiresAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.expires_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.reason') IS NEW.reason
      AND json_extract(audit.after_json, '$.actorAccountId') IS NEW.actor_account_id
      AND json_extract(audit.after_json, '$.recordedAt') IS strftime('%Y-%m-%dT%H:%M:%fZ', NEW.recorded_at / 1000.0, 'unixepoch')
      AND json_extract(audit.after_json, '$.auditEventId') IS NEW.audit_event_id
      AND ((NEW.revision = 1 AND audit.before_json IS NULL) OR (NEW.revision > 1 AND audit.before_json = (
        SELECT previous_audit.after_json FROM system_audit_disclosure_policy_revisions previous
        JOIN system_audit_events previous_audit ON previous_audit.event_id = previous.audit_event_id
        WHERE previous.scope = NEW.scope AND previous.revision = NEW.revision - 1
      )))
  );
END;
