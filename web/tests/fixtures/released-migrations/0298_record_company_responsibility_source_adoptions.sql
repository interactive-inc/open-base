CREATE TABLE company_responsibility_source_adoptions (
  organization_id TEXT NOT NULL DEFAULT 'organization:default'
    CHECK (organization_id = 'organization:default'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_id TEXT NOT NULL CHECK (length(trim(source_id)) BETWEEN 1 AND 255),
  source_version TEXT NOT NULL CHECK (length(trim(source_version)) BETWEEN 1 AND 255),
  command_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'responsibility-assignment'
    CHECK (resource_type = 'responsibility-assignment'),
  resource_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision > 0),
  snapshot_digest TEXT NOT NULL
    CHECK (length(snapshot_digest) = 64 AND snapshot_digest NOT GLOB '*[^0-9a-f]*'),
  source_json TEXT NOT NULL
    CHECK (json_valid(source_json) AND json_type(source_json) = 'object'
      AND length(CAST(source_json AS BLOB)) <= 750000),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL
    CHECK (organization_revision = expected_revision + 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  PRIMARY KEY (organization_id, source_context, source_kind, source_id, source_version),
  UNIQUE (organization_id, command_id),
  FOREIGN KEY (organization_id, command_id)
    REFERENCES company_command_receipts(organization_id, command_id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT,
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT
);

CREATE TRIGGER company_responsibility_source_adoptions_insert_guard
BEFORE INSERT ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_resource_invalid')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_resource_revisions resource
    JOIN company_command_receipts receipt
      ON receipt.organization_id = resource.organization_id
      AND receipt.command_id = resource.command_id
    WHERE resource.organization_id = NEW.organization_id
      AND resource.resource_type = NEW.resource_type
      AND resource.resource_id = NEW.resource_id
      AND resource.revision = NEW.resource_revision
      AND resource.command_id = NEW.command_id
      AND resource.organization_revision = NEW.organization_revision
      AND resource.actor_account_id = NEW.actor_account_id
      AND resource.reason = NEW.reason
      AND resource.recorded_at = NEW.recorded_at
      AND receipt.expected_revision = NEW.expected_revision
  );
END;

CREATE TRIGGER company_responsibility_source_adoptions_update_guard
BEFORE UPDATE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;

CREATE TRIGGER company_responsibility_source_adoptions_delete_guard
BEFORE DELETE ON company_responsibility_source_adoptions
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_adoption_immutable');
END;
