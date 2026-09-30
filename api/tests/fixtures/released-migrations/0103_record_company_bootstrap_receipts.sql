CREATE TABLE company_bootstrap_receipts (
  command_id TEXT PRIMARY KEY NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  organization_id TEXT NOT NULL UNIQUE REFERENCES company_organizations(id) CHECK (organization_id = 'organization:default'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > 0),
  declaration_json TEXT NOT NULL CHECK (json_valid(declaration_json)),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);
