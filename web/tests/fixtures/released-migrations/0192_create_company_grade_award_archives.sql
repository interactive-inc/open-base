CREATE TABLE company_grade_award_archives (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) CHECK (organization_id = 'organization:default'),
  command_id TEXT NOT NULL,
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  observed_company_revision INTEGER NOT NULL CHECK (observed_company_revision >= 0),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, command_id),
  UNIQUE (organization_id, employee_id),
  CHECK (json_extract(source_json, '$.employeeId') IS employee_id),
  CHECK (json_extract(source_json, '$.organizationRevision') IS observed_company_revision)
);
