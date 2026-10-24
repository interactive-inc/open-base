CREATE TABLE system_record_coverage_pages (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  previous_digest TEXT,
  after_cursor TEXT,
  next_cursor TEXT,
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(freeze_id,record_kind,sequence),
  UNIQUE(freeze_id,record_kind,digest),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.recordKind') IS record_kind),
  CHECK(json_extract(snapshot_json,'$.sequence') IS sequence),
  CHECK(json_extract(snapshot_json,'$.previousDigest') IS previous_digest),
  CHECK(json_extract(snapshot_json,'$.afterCursor') IS after_cursor),
  CHECK(json_extract(snapshot_json,'$.nextCursor') IS next_cursor),
  CHECK(json_type(snapshot_json,'$.records') IS 'array' AND json_array_length(snapshot_json,'$.records') <= 100),
  CHECK(next_cursor IS NULL OR (length(next_cursor)>0 AND next_cursor IS NOT after_cursor AND json_array_length(snapshot_json,'$.records')>0)),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE UNIQUE INDEX system_record_coverage_pages_cursor_idx
  ON system_record_coverage_pages(freeze_id,record_kind,after_cursor) WHERE after_cursor IS NOT NULL;
CREATE TABLE system_record_coverage_entries (
  -- 照合の trigger が行を足すため、主キーは列の既定値で採番する。
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))),
  page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  preserved_record_id TEXT NOT NULL REFERENCES system_preserved_records(id),
  UNIQUE(freeze_id,record_kind,source_record_id),
  UNIQUE(freeze_id,preserved_record_id),
  CHECK (length(id) = 36 AND id NOT GLOB '*[^0-9a-f-]*' AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND substr(id, 15, 1) GLOB '[1-8]' AND substr(id, 20, 1) GLOB '[89ab]')
);
CREATE TRIGGER system_record_coverage_entries_identity_update
BEFORE UPDATE OF id ON system_record_coverage_entries
WHEN NEW.id IS NOT OLD.id
BEGIN SELECT RAISE(ABORT, 'record_identity_immutable'); END;

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

DROP TRIGGER IF EXISTS system_record_coverage_pages_index;
CREATE TRIGGER system_record_coverage_pages_index AFTER INSERT ON system_record_coverage_pages
BEGIN
  INSERT INTO system_record_coverage_entries(page_id,freeze_id,record_kind,source_record_id,preserved_record_id)
    SELECT NEW.id,NEW.freeze_id,NEW.record_kind,json_extract(item.value,'$.source.recordId'),json_extract(item.value,'$.preservedRecordId')
    FROM json_each(NEW.snapshot_json,'$.records') item;
END;

DROP TRIGGER IF EXISTS system_record_coverage_pages_update;
CREATE TRIGGER system_record_coverage_pages_update BEFORE UPDATE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

DROP TRIGGER IF EXISTS system_record_coverage_pages_delete;
CREATE TRIGGER system_record_coverage_pages_delete BEFORE DELETE ON system_record_coverage_pages
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

DROP TRIGGER IF EXISTS system_record_coverage_entries_update;
CREATE TRIGGER system_record_coverage_entries_update BEFORE UPDATE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

DROP TRIGGER IF EXISTS system_record_coverage_entries_delete;
CREATE TRIGGER system_record_coverage_entries_delete BEFORE DELETE ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_immutable');
END;

DROP TRIGGER IF EXISTS system_record_coverage_entries_insert;
CREATE TRIGGER system_record_coverage_entries_insert BEFORE INSERT ON system_record_coverage_entries
BEGIN
  SELECT RAISE(ABORT,'record_coverage_entry_duplicate') WHERE EXISTS (
    SELECT 1 FROM system_record_coverage_entries WHERE freeze_id=NEW.freeze_id
      AND ((record_kind=NEW.record_kind AND source_record_id=NEW.source_record_id) OR preserved_record_id=NEW.preserved_record_id)
  );
  SELECT RAISE(ABORT,'record_coverage_source_mismatch') WHERE NOT EXISTS (
    SELECT 1 FROM system_record_coverage_pages p, json_each(p.snapshot_json,'$.records') item
    JOIN system_preserved_records r ON r.id=NEW.preserved_record_id
    WHERE p.id=NEW.page_id AND p.freeze_id=NEW.freeze_id AND p.record_kind=NEW.record_kind
      AND json_extract(item.value,'$.preservedRecordId') IS NEW.preserved_record_id
      AND json_extract(item.value,'$.source.recordId') IS NEW.source_record_id
      AND json_extract(item.value,'$.source.sourceNamespace') IS json_extract(p.snapshot_json,'$.sourceNamespace')
      AND json_extract(item.value,'$.source.ownerContext') IS json_extract(p.snapshot_json,'$.ownerContext')
      AND json_extract(item.value,'$.source.recordKind') IS NEW.record_kind
      AND json_extract(item.value,'$.source') IS json_extract(r.snapshot_json,'$.source')
  );
END;
