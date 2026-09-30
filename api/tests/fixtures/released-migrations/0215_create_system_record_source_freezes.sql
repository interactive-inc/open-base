CREATE TABLE system_record_source_freezes (
  id TEXT PRIMARY KEY NOT NULL,
  source_namespace TEXT NOT NULL CHECK (length(source_namespace) BETWEEN 1 AND 255),
  owner_context TEXT NOT NULL CHECK (length(owner_context) BETWEEN 1 AND 100),
  revision INTEGER NOT NULL CHECK (revision IN (1, 2)),
  created_audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  release_audit_event_id TEXT UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  CHECK (json_extract(snapshot_json, '$.id') IS id),
  CHECK (json_extract(snapshot_json, '$.sourceNamespace') IS source_namespace),
  CHECK (json_extract(snapshot_json, '$.ownerContext') IS owner_context),
  CHECK (json_extract(snapshot_json, '$.revision') IS revision),
  CHECK (json_extract(snapshot_json, '$.auditEventId') IS created_audit_event_id),
  CHECK (json_type(snapshot_json, '$.actorAccountId') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.actorAccountId'))) BETWEEN 1 AND 255),
  CHECK (json_type(snapshot_json, '$.reason') IS 'text'
    AND length(trim(json_extract(snapshot_json, '$.reason'))) BETWEEN 1 AND 2000),
  CHECK (julianday(json_extract(snapshot_json, '$.createdAt')) IS NOT NULL
    AND julianday(json_extract(snapshot_json, '$.createdAt')) >= julianday('1970-01-01T00:00:00Z')),
  CHECK ((revision = 1 AND release_audit_event_id IS NULL AND json_type(snapshot_json, '$.release') IS 'null')
    OR (revision = 2 AND release_audit_event_id IS NOT NULL AND release_audit_event_id <> created_audit_event_id
      AND json_type(snapshot_json, '$.release') IS 'object'
      AND json_extract(snapshot_json, '$.release.auditEventId') IS release_audit_event_id
      AND json_type(snapshot_json, '$.release.actorAccountId') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.actorAccountId'))) BETWEEN 1 AND 255
      AND json_type(snapshot_json, '$.release.reason') IS 'text'
      AND length(trim(json_extract(snapshot_json, '$.release.reason'))) BETWEEN 1 AND 2000
      AND julianday(json_extract(snapshot_json, '$.release.at')) IS NOT NULL
      AND julianday(json_extract(snapshot_json, '$.release.at')) >= julianday(json_extract(snapshot_json, '$.createdAt'))))
);
-- 同じDB内では保存元設定を変更しても停止中の所有業務を迂回させない。
CREATE UNIQUE INDEX system_record_source_freezes_active_owner_idx
  ON system_record_source_freezes(owner_context) WHERE revision = 1;
