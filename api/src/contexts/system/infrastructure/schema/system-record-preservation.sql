CREATE TABLE system_record_disclosure_policies (
  revision_id TEXT PRIMARY KEY NOT NULL,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  record_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  UNIQUE (id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.recordId') IS record_id),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.grants') IS 'array'),
  CHECK (json_extract(snapshot_json, '$.status') IS 'active' OR json_extract(snapshot_json, '$.status') IS 'revoked'),
  CHECK (julianday(json_extract(snapshot_json, '$.publishedAt')) IS NOT NULL)
);

CREATE TABLE system_preserved_records (
  id TEXT PRIMARY KEY NOT NULL,
  attachment_id TEXT NOT NULL UNIQUE REFERENCES system_attachments(id),
  preservation_id TEXT NOT NULL UNIQUE REFERENCES system_attachment_preservations(id),
  disclosure_policy_id TEXT NOT NULL,
  disclosure_policy_revision INTEGER NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  FOREIGN KEY (disclosure_policy_id, disclosure_policy_revision) REFERENCES system_record_disclosure_policies(id, revision),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.attachmentId') IS attachment_id),
  CHECK (json_extract(snapshot_json, '$.preservationId') IS preservation_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyId') IS disclosure_policy_id),
  CHECK (json_extract(snapshot_json, '$.disclosurePolicyRevision') IS disclosure_policy_revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS audit_event_id),
  CHECK (json_type(snapshot_json, '$.source') IS 'object'),
  CHECK (json_type(snapshot_json, '$.sourceAuthorizationRef') IS 'object'),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.finalizedAt')) IS NOT NULL),
  CHECK (julianday(json_extract(snapshot_json, '$.source.capturedAt')) <= julianday(json_extract(snapshot_json, '$.finalizedAt')))
);
CREATE INDEX system_preserved_records_source_idx ON system_preserved_records (
  json_extract(snapshot_json, '$.source.sourceNamespace'),
  json_extract(snapshot_json, '$.source.ownerContext'),
  json_extract(snapshot_json, '$.source.recordKind'),
  json_extract(snapshot_json, '$.source.recordId')
);

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

DROP TRIGGER IF EXISTS system_record_disclosure_prevent_update;
CREATE TRIGGER system_record_disclosure_prevent_update
BEFORE UPDATE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;

DROP TRIGGER IF EXISTS system_record_disclosure_prevent_delete;
CREATE TRIGGER system_record_disclosure_prevent_delete
BEFORE DELETE ON system_record_disclosure_policies
BEGIN
  SELECT RAISE(ABORT, 'record_disclosure_history_immutable');
END;

DROP TRIGGER IF EXISTS system_preserved_record_insert_guard;
CREATE TRIGGER system_preserved_record_insert_guard
BEFORE INSERT ON system_preserved_records
WHEN NOT EXISTS (
  SELECT 1 FROM system_attachments a JOIN system_attachment_preservations h ON h.attachment_id = a.id
  WHERE a.id = NEW.attachment_id AND h.id = NEW.preservation_id
    AND a.status = 'linked' AND a.content_type IN ('application/vnd.record-preservation+json', 'application/vnd.record-preservation+binary')
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

DROP TRIGGER IF EXISTS system_preserved_record_prevent_update;
CREATE TRIGGER system_preserved_record_prevent_update
BEFORE UPDATE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;

DROP TRIGGER IF EXISTS system_preserved_record_prevent_delete;
CREATE TRIGGER system_preserved_record_prevent_delete
BEFORE DELETE ON system_preserved_records
BEGIN
  SELECT RAISE(ABORT, 'preserved_record_immutable');
END;
