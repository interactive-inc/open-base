DROP TRIGGER IF EXISTS system_record_disclosure_publication_guard;
CREATE TRIGGER system_record_disclosure_publication_guard
BEFORE INSERT ON system_record_disclosure_policies
WHEN NEW.revision != COALESCE((SELECT MAX(revision) FROM system_record_disclosure_policies WHERE id = NEW.id), 0) + 1
  OR EXISTS (SELECT 1 FROM system_record_disclosure_policies p WHERE p.id = NEW.id AND (
    p.record_id != NEW.record_id OR julianday(json_extract(p.snapshot_json, '$.publishedAt')) > julianday(json_extract(NEW.snapshot_json, '$.publishedAt'))))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.disclosure_policy.published' AND a.target_type = 'system:record-disclosure-policy'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.publishedAt'))
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_publication_invalid');
END;
