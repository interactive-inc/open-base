DROP TRIGGER IF EXISTS system_preserved_record_insert_guard;
CREATE TRIGGER system_preserved_record_insert_guard
BEFORE INSERT ON system_preserved_records
WHEN NOT EXISTS (
  SELECT 1 FROM system_attachments a JOIN system_attachment_preservations h ON h.attachment_id = a.id
  WHERE a.id = NEW.attachment_id AND h.id = NEW.preservation_id
    AND a.status = 'linked' AND a.content_type = 'application/vnd.record-preservation+json'
    AND a.plaintext_sha256 = json_extract(NEW.snapshot_json, '$.attachmentDigest')
    AND h.plaintext_sha256 = a.plaintext_sha256 AND h.released_at IS NULL
    AND h.created_by_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND strftime('%Y-%m-%dT%H:%M:%fZ', h.created_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt')
    AND (h.kind = 'hold' OR h.retain_until > h.created_at))
  OR NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies p
    WHERE p.id = NEW.disclosure_policy_id AND p.revision = NEW.disclosure_policy_revision
      AND p.record_id = NEW.id AND json_extract(p.snapshot_json, '$.status') = 'active'
      AND julianday(json_extract(p.snapshot_json, '$.publishedAt')) <= julianday(json_extract(NEW.snapshot_json, '$.finalizedAt'))
      AND NOT EXISTS (SELECT 1 FROM system_record_disclosure_policies later WHERE later.id = p.id AND later.revision > p.revision))
  OR NOT EXISTS (SELECT 1 FROM system_audit_events a WHERE a.event_id = NEW.audit_event_id
    AND a.action = 'system.record.preserved' AND a.target_type = 'system:preserved-record'
    AND a.target_id = NEW.id AND a.outcome = 'succeeded'
    AND a.actor_account_id = json_extract(NEW.snapshot_json, '$.actorAccountId')
    AND a.after_json = NEW.snapshot_json
    AND strftime('%Y-%m-%dT%H:%M:%fZ', a.occurred_at / 1000.0, 'unixepoch') = json_extract(NEW.snapshot_json, '$.finalizedAt'))
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_dependencies_invalid');
END;
