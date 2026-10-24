CREATE TABLE company_definition_resource_adoptions (
  organization_id TEXT NOT NULL DEFAULT 'organization:default' CHECK (organization_id = 'organization:default'),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('grade', 'position')),
  definition_id INTEGER NOT NULL CHECK (definition_id > 0),
  resource_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision = expected_revision + 1),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 20000
    AND json_extract(source_json, '$.definition.type') IS resource_type
    AND json_extract(source_json, '$.definition.id') IS definition_id
    AND json_extract(source_json, '$.organizationRevision') IS expected_revision),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, command_id),
  UNIQUE (resource_type, definition_id),
  UNIQUE (organization_id, resource_type, resource_id),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT
);
