CREATE TABLE system_record_disclosure_policies (
  id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  record_id TEXT NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (id, revision),
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
