CREATE TABLE company_responsibility_source_cutovers (
  organization_id TEXT NOT NULL DEFAULT 'organization:default'
    CHECK (organization_id = 'organization:default'),
  source_context TEXT NOT NULL CHECK (length(trim(source_context)) BETWEEN 1 AND 100),
  source_kind TEXT NOT NULL CHECK (length(trim(source_kind)) BETWEEN 1 AND 100),
  source_namespace TEXT NOT NULL CHECK (length(trim(source_namespace)) BETWEEN 1 AND 255),
  freeze_id TEXT NOT NULL,
  source_count INTEGER NOT NULL CHECK (source_count >= 0),
  adopted_count INTEGER NOT NULL CHECK (adopted_count = source_count),
  source_manifest_digest TEXT NOT NULL
    CHECK (length(source_manifest_digest) = 64
      AND source_manifest_digest NOT GLOB '*[^0-9a-f]*'),
  source_manifest_json TEXT NOT NULL
    CHECK (json_valid(source_manifest_json) AND json_type(source_manifest_json) = 'array'
      AND json_array_length(source_manifest_json) = source_count
      AND length(CAST(source_manifest_json AS BLOB)) <= 750000),
  audit_event_id TEXT NOT NULL REFERENCES company_audit_events(event_id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  completed_at INTEGER NOT NULL CHECK (completed_at >= 0),
  PRIMARY KEY (organization_id, source_context, source_kind),
  UNIQUE (freeze_id),
  FOREIGN KEY (freeze_id) REFERENCES system_record_source_freezes(id) ON DELETE RESTRICT
);

CREATE TRIGGER company_responsibility_source_cutovers_insert_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_freeze_invalid')
  WHERE NOT EXISTS (
    SELECT 1 FROM system_record_source_freezes freeze
    WHERE freeze.id = NEW.freeze_id
      AND freeze.source_namespace = NEW.source_namespace
      AND freeze.owner_context = NEW.source_context
      AND freeze.revision = 1
  );

  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_manifest_invalid')
  WHERE EXISTS (
    SELECT 1 FROM json_each(NEW.source_manifest_json) entry
    WHERE json_type(entry.value) <> 'object'
      OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_source_adoptions adoption
        WHERE adoption.organization_id = NEW.organization_id
          AND adoption.source_context = NEW.source_context
          AND adoption.source_kind = NEW.source_kind
          AND adoption.source_namespace = NEW.source_namespace
          AND adoption.freeze_id = NEW.freeze_id
          AND adoption.source_id = json_extract(entry.value, '$.sourceId')
          AND adoption.source_version = json_extract(entry.value, '$.sourceVersion')
      )
  ) OR EXISTS (
    SELECT 1 FROM company_responsibility_source_adoptions adoption
    WHERE adoption.organization_id = NEW.organization_id
      AND adoption.source_context = NEW.source_context
      AND adoption.source_kind = NEW.source_kind
      AND adoption.source_namespace = NEW.source_namespace
      AND adoption.freeze_id = NEW.freeze_id
      AND NOT EXISTS (
        SELECT 1 FROM json_each(NEW.source_manifest_json) entry
        WHERE json_extract(entry.value, '$.sourceId') = adoption.source_id
          AND json_extract(entry.value, '$.sourceVersion') = adoption.source_version
      )
  );
END;

CREATE TRIGGER company_responsibility_source_cutovers_update_guard
BEFORE UPDATE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;

CREATE TRIGGER company_responsibility_source_cutovers_delete_guard
BEFORE DELETE ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_immutable');
END;
