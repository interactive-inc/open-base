CREATE TABLE system_audit_disclosure_policy_revisions (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL CHECK (length(scope) BETWEEN 1 AND 255),
  revision INTEGER NOT NULL CHECK (revision > 0),
  command_id TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  allowed_fields_json TEXT NOT NULL CHECK (json_valid(allowed_fields_json) AND json_type(allowed_fields_json) = 'array'),
  allowed_target_types_json TEXT CHECK (allowed_target_types_json IS NULL OR (json_valid(allowed_target_types_json) AND json_type(allowed_target_types_json) = 'array')),
  allowed_purposes_json TEXT CHECK (allowed_purposes_json IS NULL OR (json_valid(allowed_purposes_json) AND json_type(allowed_purposes_json) = 'array')),
  expires_at INTEGER,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id) ON DELETE RESTRICT,
  CHECK (expires_at IS NULL OR expires_at > recorded_at)
);

CREATE UNIQUE INDEX system_audit_disclosure_scope_revision_uniq
  ON system_audit_disclosure_policy_revisions (scope, revision);

CREATE TRIGGER system_audit_disclosure_revision_insert
BEFORE INSERT ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit_disclosure_revision_conflict')
  WHERE NEW.revision <> 1 + COALESCE((SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0)
    OR NEW.recorded_at < COALESCE((SELECT MAX(recorded_at) FROM system_audit_disclosure_policy_revisions WHERE scope = NEW.scope), 0);
  SELECT RAISE(ABORT, 'audit_disclosure_scope_unavailable')
  WHERE NEW.scope <> '*' AND NOT EXISTS (SELECT 1 FROM system_accounts WHERE id = NEW.scope);
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

CREATE TRIGGER system_audit_disclosure_revision_update
BEFORE UPDATE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;

CREATE TRIGGER system_audit_disclosure_revision_delete
BEFORE DELETE ON system_audit_disclosure_policy_revisions
BEGIN
  SELECT RAISE(ABORT, 'audit disclosure revisions are immutable');
END;
