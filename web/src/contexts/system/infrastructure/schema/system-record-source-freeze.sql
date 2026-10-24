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
      AND julianday(json_extract(snapshot_json, '$.release.at')) >= julianday(json_extract(snapshot_json, '$.createdAt')))),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
-- 同じDB内では保存元設定を変更しても停止中の所有業務を迂回させない。
CREATE UNIQUE INDEX system_record_source_freezes_active_owner_idx
  ON system_record_source_freezes(owner_context) WHERE revision = 1;

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

DROP TRIGGER IF EXISTS system_record_source_freezes_delete;
CREATE TRIGGER system_record_source_freezes_delete
BEFORE DELETE ON system_record_source_freezes
BEGIN
  SELECT RAISE(ABORT, 'record_source_freeze_immutable');
END;
