CREATE TABLE customer_catalog_revisions (
  record_id TEXT NOT NULL CHECK (length(record_id) = 36),
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) = 36),
  recorded_at TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  PRIMARY KEY (record_id, revision),
  UNIQUE (actor_account_id, idempotency_key),
  CHECK (json_extract(snapshot_json, '$.id') IS record_id),
  CHECK (json_extract(snapshot_json, '$.expected_revision') IS revision - 1)
);
--> statement-breakpoint
CREATE TRIGGER customer_catalog_append BEFORE INSERT ON customer_catalog_revisions
WHEN NEW.revision != coalesce((SELECT max(revision) FROM customer_catalog_revisions WHERE record_id = NEW.record_id), 0) + 1
BEGIN SELECT raise(ABORT, 'catalog_revision_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER customer_catalog_no_update BEFORE UPDATE ON customer_catalog_revisions
BEGIN SELECT raise(ABORT, 'catalog_revision_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER customer_catalog_no_delete BEFORE DELETE ON customer_catalog_revisions
BEGIN SELECT raise(ABORT, 'catalog_revision_retained'); END;
