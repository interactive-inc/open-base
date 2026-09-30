CREATE VIEW company_responsibility_assignment_overlaps AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'responsibility-assignment' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), intervals AS (
  SELECT organization_id, resource_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on,
    json_extract(attributes_json, '$.responsibilityId') AS responsibility_id,
    json_extract(attributes_json, '$.holderType') AS holder_type,
    json_extract(attributes_json, '$.holderId') AS holder_id,
    json_extract(attributes_json, '$.authorityScopeId') AS scope_id
  FROM next_versions WHERE state = 'active'
)
SELECT DISTINCT first.organization_id, first.holder_type, first.holder_id
FROM intervals first JOIN intervals second
  ON first.organization_id = second.organization_id AND first.resource_id < second.resource_id
  AND first.responsibility_id = second.responsibility_id AND first.holder_type = second.holder_type
  AND first.holder_id = second.holder_id AND first.scope_id IS second.scope_id
  AND (first.ends_on IS NULL OR second.starts_on < first.ends_on)
  AND (second.ends_on IS NULL OR first.starts_on < second.ends_on);

SELECT json_extract('{}', 'company_responsibility_assignment_overlap') FROM company_responsibility_assignment_overlaps LIMIT 1;
DROP INDEX company_active_responsibility_assignment_uniq;

DROP TRIGGER IF EXISTS company_responsibility_assignment_revision_guard;
CREATE TRIGGER company_responsibility_assignment_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps WHERE organization_id = NEW.id);
END;
DROP TRIGGER IF EXISTS company_responsibility_assignment_operation_guard;
CREATE TRIGGER company_responsibility_assignment_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps);
END;
DROP TRIGGER IF EXISTS company_responsibility_assignment_lifecycle_guard;
CREATE TRIGGER company_responsibility_assignment_lifecycle_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility assignment periods overlap')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_assignment_overlaps
    WHERE organization_id = NEW.organization_id AND holder_type = 'employee' AND holder_id = NEW.employee_id);
END;

CREATE TABLE company_responsibility_resource_adoptions (
  command_id TEXT PRIMARY KEY NOT NULL CHECK (length(command_id) BETWEEN 1 AND 200),
  operation_id TEXT NOT NULL UNIQUE REFERENCES company_organization_change_operations(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  actor_account_id TEXT NOT NULL REFERENCES system_accounts(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 1000),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  organization_revision INTEGER NOT NULL CHECK (organization_revision > expected_revision AND organization_revision <= expected_revision + 10),
  observed_on TEXT NOT NULL CHECK (length(observed_on) = 10),
  adopted_periods INTEGER NOT NULL CHECK (adopted_periods BETWEEN 1 AND 1000),
  snapshot_digest TEXT NOT NULL CHECK (length(snapshot_digest) = 64),
  source_json TEXT NOT NULL CHECK (json_valid(source_json) AND length(CAST(source_json AS BLOB)) <= 750000),
  mappings_json TEXT NOT NULL CHECK (json_valid(mappings_json) AND json_type(mappings_json) = 'array' AND json_array_length(mappings_json) = adopted_periods AND length(CAST(mappings_json AS BLOB)) <= 750000),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  UNIQUE (employee_id, snapshot_digest)
);

DROP TRIGGER IF EXISTS company_responsibility_adoption_insert_guard;
CREATE TRIGGER company_responsibility_adoption_insert_guard
BEFORE INSERT ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is incomplete') WHERE NOT EXISTS (
    SELECT 1 FROM company_organization_change_operations operation
    WHERE operation.id = NEW.operation_id AND operation.status = 'PENDING'
      AND operation.change_count = NEW.adopted_periods AND operation.applied_count = NEW.adopted_periods
      AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
  ) OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'organization:default')
  OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_responsibility_period_versions period WHERE period.recorded_by_action_id = NEW.operation_id)
  OR EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions period
    WHERE period.recorded_by_action_id = NEW.operation_id AND (
      period.employee_id != NEW.employee_id OR NOT EXISTS (
        SELECT 1 FROM company_responsibility_period_bindings binding
        JOIN company_responsibility_resource_bindings source ON source.resource_id = binding.resource_id
        JOIN json_each(NEW.mappings_json) mapping ON json_extract(mapping.value, '$.periodId') = period.period_id
        WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision AND binding.source_revision = 1
          AND source.resource_revision = 1 AND source.employee_id = NEW.employee_id
          AND source.responsibility_id = json_extract(mapping.value, '$.responsibilityId')
          AND source.authority_scope_id = json_extract(mapping.value, '$.authorityScopeId')
      )
    )
  );
END;
DROP TRIGGER IF EXISTS company_responsibility_adoption_update_guard;
CREATE TRIGGER company_responsibility_adoption_update_guard
BEFORE UPDATE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_adoption_delete_guard;
CREATE TRIGGER company_responsibility_adoption_delete_guard
BEFORE DELETE ON company_responsibility_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_adoption_completion_guard;
CREATE TRIGGER company_responsibility_adoption_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NEW.id GLOB 'responsibility-adoption:*'
BEGIN
  SELECT RAISE(ABORT, 'responsibility adoption evidence is missing')
  WHERE NOT EXISTS (SELECT 1 FROM company_responsibility_resource_adoptions adoption WHERE adoption.operation_id = NEW.id);
END;
