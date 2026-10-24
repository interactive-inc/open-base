DROP TRIGGER IF EXISTS system_record_source_freezes_update;
CREATE TRIGGER system_record_source_freezes_update
BEFORE UPDATE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable')
  WHERE OLD.revision <> 1 OR NEW.revision <> 2 OR NEW.id IS NOT OLD.id
    OR NEW.source_namespace IS NOT OLD.source_namespace OR NEW.owner_context IS NOT OLD.owner_context
    OR NEW.created_audit_event_id IS NOT OLD.created_audit_event_id
    OR json_remove(NEW.snapshot_json, '$.release', '$.revision') IS NOT json_remove(OLD.snapshot_json, '$.release', '$.revision');
  SELECT RAISE(ABORT, 'record_source_freeze_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events WHERE event_id = NEW.release_audit_event_id
      AND actor_account_id = json_extract(NEW.snapshot_json, '$.release.actorAccountId')
      AND action = 'system.record.source.freeze.released' AND target_type = 'system:record-source-freeze'
      AND target_id = NEW.id AND outcome = 'succeeded'
      AND before_json IS OLD.snapshot_json AND after_json IS NEW.snapshot_json
      AND strftime('%Y-%m-%dT%H:%M:%fZ', occurred_at / 1000.0, 'unixepoch') IS json_extract(NEW.snapshot_json, '$.release.at')
  );
END;
