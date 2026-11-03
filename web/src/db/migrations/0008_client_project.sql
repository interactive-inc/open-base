CREATE TABLE client_project_records (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  kind TEXT NOT NULL CHECK (kind IN ('project', 'effort')),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  UNIQUE (id, kind)
);
--> statement-breakpoint
CREATE TABLE client_project_revisions (
  record_id TEXT NOT NULL REFERENCES client_project_records(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) = 36),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 3000),
  recorded_at TEXT NOT NULL,
  request_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  customer_id TEXT GENERATED ALWAYS AS (json_extract(snapshot_json, '$.customer_id')) VIRTUAL,
  project_id TEXT GENERATED ALWAYS AS (json_extract(snapshot_json, '$.project_id')) VIRTUAL,
  owner_employee_id TEXT GENERATED ALWAYS AS (json_extract(snapshot_json, '$.owner_employee_id')) VIRTUAL REFERENCES company_employees(id),
  project_kind TEXT GENERATED ALWAYS AS ('project') VIRTUAL,
  FOREIGN KEY (project_id, project_kind) REFERENCES client_project_records(id, kind),
  PRIMARY KEY (record_id, revision),
  UNIQUE (actor_account_id, idempotency_key),
  CHECK (json_extract(snapshot_json, '$.id') IS record_id),
  CHECK (json_extract(snapshot_json, '$.expected_revision') IS revision - 1)
);
--> statement-breakpoint
CREATE TRIGGER client_project_append_revision BEFORE INSERT ON client_project_revisions
WHEN NEW.revision != coalesce((SELECT max(revision) FROM client_project_revisions WHERE record_id = NEW.record_id), 0) + 1
  OR json_extract(NEW.snapshot_json, '$.kind') IS NOT (SELECT kind FROM client_project_records WHERE id = NEW.record_id)
  OR (json_extract(NEW.snapshot_json, '$.kind') = 'effort' AND NEW.revision > 1 AND NEW.project_id IS NOT
    (SELECT project_id FROM client_project_revisions WHERE record_id = NEW.record_id AND revision = 1))
BEGIN SELECT raise(ABORT, 'client_project_revision_conflict'); END;
--> statement-breakpoint
CREATE TRIGGER client_project_no_revision_update BEFORE UPDATE ON client_project_revisions
BEGIN SELECT raise(ABORT, 'client_project_revision_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER client_project_no_revision_delete BEFORE DELETE ON client_project_revisions
BEGIN SELECT raise(ABORT, 'client_project_revision_retained'); END;
--> statement-breakpoint
CREATE VIEW client_project_current AS
SELECT record.id, record.kind, record.employee_id, history.*
FROM client_project_records record JOIN client_project_revisions history
  ON history.record_id = record.id
WHERE history.revision = (SELECT max(latest.revision) FROM client_project_revisions latest WHERE latest.record_id = record.id);
--> statement-breakpoint
CREATE INDEX client_project_records_by_kind ON client_project_records(kind, id);
--> statement-breakpoint
CREATE INDEX client_project_revisions_by_project ON client_project_revisions(project_id, record_id, revision);
