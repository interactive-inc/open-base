CREATE TABLE system_record_retirement_plans (
  id TEXT PRIMARY KEY NOT NULL,
  freeze_id TEXT NOT NULL REFERENCES system_record_source_freezes(id),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.freezeId') IS freeze_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id),
  CHECK(json_type(snapshot_json,'$.capability.recordKinds') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.capability.recordKinds') BETWEEN 1 AND 256),
  CHECK(json_type(snapshot_json,'$.coverage') IS 'array'),
  CHECK(json_array_length(snapshot_json,'$.coverage') IS json_array_length(snapshot_json,'$.capability.recordKinds'))
);
