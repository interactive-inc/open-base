CREATE TABLE system_record_retirement_receipts (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES system_record_retirement_plans(id),
  ordinal INTEGER NOT NULL CHECK(ordinal > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
  coverage_page_id TEXT NOT NULL REFERENCES system_record_coverage_pages(id),
  audit_event_id TEXT NOT NULL UNIQUE REFERENCES system_audit_events(event_id),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  UNIQUE(plan_id,ordinal),
  UNIQUE(plan_id,coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.id') IS id),
  CHECK(json_extract(snapshot_json,'$.planId') IS plan_id),
  CHECK(json_extract(snapshot_json,'$.ordinal') IS ordinal),
  CHECK(json_extract(snapshot_json,'$.coveragePageId') IS coverage_page_id),
  CHECK(json_extract(snapshot_json,'$.auditEventId') IS audit_event_id)
);
