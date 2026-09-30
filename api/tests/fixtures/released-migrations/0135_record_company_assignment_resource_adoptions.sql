CREATE TABLE company_assignment_resource_adoptions (
  command_id TEXT PRIMARY KEY NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision),
  observed_on TEXT NOT NULL,
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (employee_id, snapshot_digest)
);
