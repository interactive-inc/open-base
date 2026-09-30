DROP TRIGGER IF EXISTS system_record_coverage_pages_insert;
CREATE TRIGGER system_record_coverage_pages_insert BEFORE INSERT ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_page_conflict') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_pages WHERE id=NEW.id
      OR (freeze_id=NEW.freeze_id AND record_kind=NEW.record_kind AND sequence>=NEW.sequence)
  );
  SELECT RAISE(ABORT,'record_coverage_freeze_unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes WHERE id=NEW.freeze_id AND revision=1
      AND source_namespace IS json_extract(NEW.snapshot_json,'$.sourceNamespace')
      AND owner_context IS json_extract(NEW.snapshot_json,'$.ownerContext')
  );
  SELECT RAISE(ABORT,'record_coverage_page_gap') WHERE
    (NEW.sequence=1 AND (NEW.previous_digest IS NOT NULL OR NEW.after_cursor IS NOT NULL))
    OR (NEW.sequence>1 AND NOT EXISTS (
      SELECT 1 FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id
        AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1
        AND p.digest IS NEW.previous_digest AND p.next_cursor IS NOT NULL AND p.next_cursor IS NEW.after_cursor
        AND julianday(json_extract(NEW.snapshot_json,'$.checkedAt')) >= julianday(json_extract(p.snapshot_json,'$.checkedAt'))
    ));
  SELECT RAISE(ABORT,'record_coverage_audit_missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_audit_events a WHERE a.event_id=NEW.audit_event_id
      AND a.action='system.record.coverage.page.verified' AND a.target_type='system:record-coverage-page'
      AND a.target_id=NEW.id AND a.outcome='succeeded'
      AND a.actor_account_id IS json_extract(NEW.snapshot_json,'$.actorAccountId')
      AND a.after_json IS NEW.snapshot_json
      AND a.before_json IS (SELECT p.snapshot_json FROM system_record_coverage_pages p WHERE p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind AND p.sequence=NEW.sequence-1)
      AND strftime('%Y-%m-%dT%H:%M:%fZ',a.occurred_at/1000.0,'unixepoch') IS json_extract(NEW.snapshot_json,'$.checkedAt')
  );
END;
