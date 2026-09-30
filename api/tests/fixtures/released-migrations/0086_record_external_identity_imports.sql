CREATE TABLE company_external_identity_imports (
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  machine_credential_id TEXT NOT NULL REFERENCES system_machine_credentials(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, command_id)
);
CREATE TABLE company_external_identity_sources (
  identity_id TEXT PRIMARY KEY NOT NULL REFERENCES system_identity_bindings(id) ON DELETE RESTRICT,
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  source_digest TEXT NOT NULL CHECK (length(source_digest) = 64 AND source_digest NOT GLOB '*[^0-9a-f]*'),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
);
