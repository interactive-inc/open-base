DROP TRIGGER IF EXISTS system_record_source_freezes_insert;
CREATE TRIGGER system_record_source_freezes_insert
BEFORE INSERT ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_creation_invalid') WHERE NEW.revision <> 1
    OR EXISTS (SELECT 1 FROM system_record_source_freezes
      WHERE id = NEW.id OR (owner_context = NEW.owner_context AND revision = 1));
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.created_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
      AND action = 'system.record.source.freeze.created' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded' AND before_json IS NULL
      AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.createdAt')
  );
END;
