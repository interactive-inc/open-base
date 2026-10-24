CREATE TABLE company_responsibility_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL CHECK (length(resource_id) BETWEEN 1 AND 255),
  organization_id TEXT NOT NULL REFERENCES company_organizations(id) ON DELETE RESTRICT CHECK (organization_id = 'organization:default'),
  employee_id TEXT NOT NULL REFERENCES company_employees(id) ON DELETE RESTRICT,
  employment_id TEXT NOT NULL REFERENCES company_employments(id) ON DELETE RESTRICT,
  organization_unit_id TEXT NOT NULL REFERENCES company_organization_units(id) ON DELETE RESTRICT,
  responsibility_type TEXT NOT NULL CHECK (length(responsibility_type) BETWEEN 1 AND 100),
  responsibility_id TEXT NOT NULL,
  authority_scope_id TEXT NOT NULL,
  resource_revision INTEGER NOT NULL CHECK (resource_revision >= 1),
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0)
);
CREATE INDEX company_responsibility_resource_bindings_employee_idx ON company_responsibility_resource_bindings(employee_id);
CREATE TABLE company_responsibility_period_bindings (
  period_id TEXT PRIMARY KEY NOT NULL,
  resource_id TEXT NOT NULL REFERENCES company_responsibility_resource_bindings(resource_id) ON DELETE RESTRICT,
  period_revision INTEGER NOT NULL CHECK (period_revision >= 1),
  source_revision INTEGER NOT NULL CHECK (source_revision >= 1),
  FOREIGN KEY (period_id, period_revision) REFERENCES company_organization_responsibility_period_versions(period_id, revision) ON DELETE RESTRICT
);
CREATE INDEX company_responsibility_period_bindings_resource_idx ON company_responsibility_period_bindings(resource_id);

DROP TRIGGER IF EXISTS company_responsibility_resource_binding_update_guard;
CREATE TRIGGER company_responsibility_resource_binding_update_guard
BEFORE UPDATE ON company_responsibility_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.employment_id != OLD.employment_id
  OR NEW.organization_unit_id != OLD.organization_unit_id OR NEW.responsibility_type != OLD.responsibility_type
  OR NEW.responsibility_id != OLD.responsibility_id OR NEW.authority_scope_id != OLD.authority_scope_id
  OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_resource_binding_delete_guard;
CREATE TRIGGER company_responsibility_resource_binding_delete_guard
BEFORE DELETE ON company_responsibility_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility source identity is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_period_binding_update_guard;
CREATE TRIGGER company_responsibility_period_binding_update_guard
BEFORE UPDATE ON company_responsibility_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;
DROP TRIGGER IF EXISTS company_responsibility_period_binding_delete_guard;
CREATE TRIGGER company_responsibility_period_binding_delete_guard
BEFORE DELETE ON company_responsibility_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility period source is immutable');
END;

CREATE VIEW company_responsibility_source_mismatches AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  JOIN company_responsibility_resource_bindings binding
    ON binding.organization_id = resource.organization_id AND binding.resource_id = resource.resource_id
  WHERE resource.resource_type = 'responsibility-assignment' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), definition_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('responsibility', 'authority-scope') AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), definition_intervals AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from) AS next_from
  FROM definition_versions
), intervals AS (
  SELECT organization_id, resource_id, 'public' AS kind, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
  UNION ALL
  SELECT source.organization_id, source.resource_id, 'period', period.starts_on, period.ends_on
  FROM company_responsibility_resource_bindings source
  JOIN company_responsibility_period_bindings binding ON binding.resource_id = source.resource_id
  JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
  WHERE period.is_void = 0 AND period.revision = (
    SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id
  )
  UNION ALL
  SELECT source.organization_id, source.resource_id, definition.resource_type, definition.effective_from,
    CASE WHEN definition.next_from IS NULL OR (definition.effective_to IS NOT NULL AND definition.effective_to < definition.next_from)
      THEN definition.effective_to ELSE definition.next_from END
  FROM company_responsibility_resource_bindings source
  JOIN definition_intervals definition ON definition.organization_id = source.organization_id AND (
    (definition.resource_type = 'responsibility' AND definition.resource_id = source.responsibility_id
      AND json_extract(definition.attributes_json, '$.code') = source.responsibility_type)
    OR (definition.resource_type = 'authority-scope' AND definition.resource_id = source.authority_scope_id
      AND json_extract(definition.attributes_json, '$.scopeType') = 'organization-unit'
      AND json_extract(definition.attributes_json, '$.scopeId') = source.organization_unit_id)
  ) WHERE definition.state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_id, kind ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM intervals
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_id, kind ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, resource_id, kind, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, resource_id, kind, island
)
SELECT source.organization_id, source.resource_id FROM company_responsibility_resource_bindings source
WHERE NOT EXISTS (
  SELECT 1 FROM company_resource_heads head WHERE head.organization_id = source.organization_id
    AND head.resource_type = 'responsibility-assignment' AND head.resource_id = source.resource_id
    AND head.revision = source.resource_revision
) OR NOT EXISTS (
  SELECT 1 FROM company_resource_heads definition WHERE definition.organization_id = source.organization_id
    AND definition.resource_type = 'responsibility' AND definition.resource_id = source.responsibility_id
    AND json_extract(definition.attributes_json, '$.code') = source.responsibility_type
) OR NOT EXISTS (
  SELECT 1 FROM company_resource_heads scope WHERE scope.organization_id = source.organization_id
    AND scope.resource_type = 'authority-scope' AND scope.resource_id = source.authority_scope_id
    AND json_extract(scope.attributes_json, '$.scopeType') = 'organization-unit'
    AND json_extract(scope.attributes_json, '$.scopeId') = source.organization_unit_id
) OR EXISTS (
  SELECT 1 FROM company_resource_revisions resource WHERE resource.organization_id = source.organization_id
    AND resource.resource_type = 'responsibility-assignment' AND resource.resource_id = source.resource_id
    AND (json_extract(resource.attributes_json, '$.holderType') IS NOT 'employee'
      OR json_extract(resource.attributes_json, '$.holderId') IS NOT source.employee_id
      OR json_extract(resource.attributes_json, '$.responsibilityId') IS NOT source.responsibility_id
      OR json_extract(resource.attributes_json, '$.authorityScopeId') IS NOT source.authority_scope_id)
) OR EXISTS (
  SELECT 1 FROM company_responsibility_period_bindings binding
  JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
  WHERE binding.resource_id = source.resource_id AND period.revision = (
    SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id
  ) AND (period.revision != binding.period_revision OR period.employee_id != source.employee_id
    OR period.employment_id != source.employment_id OR period.organization_unit_id != source.organization_unit_id
    OR period.responsibility_type != source.responsibility_type
    OR NOT EXISTS (SELECT 1 FROM company_resource_revisions resource WHERE resource.organization_id = source.organization_id
      AND resource.resource_type = 'responsibility-assignment' AND resource.resource_id = source.resource_id
      AND resource.revision = binding.source_revision))
) OR EXISTS (
  SELECT 1 FROM coverage expected WHERE expected.organization_id = source.organization_id AND expected.resource_id = source.resource_id
    AND expected.kind IN ('public', 'period') AND NOT EXISTS (
      SELECT 1 FROM coverage actual WHERE actual.organization_id = expected.organization_id AND actual.resource_id = expected.resource_id
        AND actual.kind IN ('public', 'period') AND actual.kind != expected.kind AND actual.starts_on <= expected.starts_on
        AND (actual.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= actual.ends_on))
    )
) OR EXISTS (
  SELECT 1 FROM coverage expected WHERE expected.organization_id = source.organization_id AND expected.resource_id = source.resource_id
    AND expected.kind = 'public' AND (
      NOT EXISTS (SELECT 1 FROM coverage definition WHERE definition.organization_id = expected.organization_id
        AND definition.resource_id = expected.resource_id AND definition.kind = 'responsibility'
        AND definition.starts_on <= expected.starts_on
        AND (definition.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= definition.ends_on)))
      OR NOT EXISTS (SELECT 1 FROM coverage scope WHERE scope.organization_id = expected.organization_id
        AND scope.resource_id = expected.resource_id AND scope.kind = 'authority-scope'
        AND scope.starts_on <= expected.starts_on
        AND (scope.ends_on IS NULL OR (expected.ends_on IS NOT NULL AND expected.ends_on <= scope.ends_on)))
    )
);

DROP TRIGGER IF EXISTS company_responsibility_source_completion_guard;
CREATE TRIGGER company_responsibility_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches);
END;
DROP TRIGGER IF EXISTS company_responsibility_source_revision_guard;
CREATE TRIGGER company_responsibility_source_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee' AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (SELECT 1 FROM company_responsibility_source_mismatches WHERE organization_id = NEW.id);
END;

DROP TRIGGER IF EXISTS company_responsibility_lifecycle_completion_guard;
CREATE TRIGGER company_responsibility_lifecycle_completion_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision != OLD.lifecycle_revision
BEGIN
  SELECT RAISE(ABORT, 'organization responsibility public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_responsibility_source_mismatches mismatch
    JOIN company_responsibility_resource_bindings source ON source.resource_id = mismatch.resource_id
    WHERE source.employee_id = NEW.employee_id AND source.organization_id = NEW.organization_id
  );
END;
