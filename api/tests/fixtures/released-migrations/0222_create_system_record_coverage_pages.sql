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
  CHECK(next_cursor IS NULL OR (length(next_cursor)>0 AND next_cursor IS NOT after_cursor AND json_array_length(snapshot_json,'$.records')>0))
);
CREATE UNIQUE INDEX system_record_coverage_pages_cursor_idx
  ON system_record_coverage_pages(freeze_id,record_kind,after_cursor) WHERE after_cursor IS NOT NULL;
CREATE TABLE system_record_coverage_entries (
  page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  record_kind TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  preserved_record_id TEXT NOT NULL REFERENCES system_preserved_records(id),
  PRIMARY KEY(freeze_id,record_kind,source_record_id),
  UNIQUE(freeze_id,preserved_record_id)
);
