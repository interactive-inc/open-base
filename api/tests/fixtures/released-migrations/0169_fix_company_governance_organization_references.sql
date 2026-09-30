DROP VIEW IF EXISTS company_governance_organization_reference_violations;
DROP VIEW IF EXISTS company_governance_organization_unit_coverage;
CREATE VIEW company_governance_organization_unit_coverage AS
WITH periods AS (
  SELECT organization_id, json_extract(attributes_json, '$.organizationUnitId') AS organization_unit_id,
    effective_from AS starts_on, effective_to AS ends_on
  FROM company_resource_heads WHERE resource_type = 'organization-unit' AND state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, organization_unit_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, organization_unit_id ORDER BY starts_on, ends_on
    ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, organization_unit_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, organization_unit_id, island;

CREATE VIEW company_governance_organization_reference_violations AS
SELECT resource.organization_id, resource.resource_type, resource.resource_id
FROM company_resource_heads resource
WHERE resource.state = 'active' AND (
  (resource.resource_type = 'organizational-office' AND (
    NOT EXISTS (
      SELECT 1 FROM company_governance_organization_unit_coverage unit
      WHERE unit.organization_id = resource.organization_id
        AND unit.organization_unit_id = json_extract(resource.attributes_json, '$.organizationUnitId')
        AND unit.starts_on <= resource.effective_from
        AND (unit.ends_on IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to <= unit.ends_on))
    ) OR NOT EXISTS (
      SELECT 1 FROM company_resource_heads position
      WHERE position.organization_id = resource.organization_id AND position.resource_type = 'position'
        AND position.resource_id = json_extract(resource.attributes_json, '$.positionId')
        AND position.state = 'active' AND position.effective_from <= resource.effective_from
        AND (position.effective_to IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to <= position.effective_to))
    )
  )) OR (resource.resource_type = 'authority-scope'
    AND json_extract(resource.attributes_json, '$.scopeType') = 'organization-unit'
    AND NOT EXISTS (
      SELECT 1 FROM company_governance_organization_unit_coverage unit
      WHERE unit.organization_id = resource.organization_id
        AND unit.organization_unit_id = json_extract(resource.attributes_json, '$.scopeId')
        AND unit.starts_on <= resource.effective_from
        AND (unit.ends_on IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to <= unit.ends_on))
    )
  )
);

SELECT json_extract('{}', 'company_governance_organization_reference_invalid')
FROM company_governance_organization_reference_violations LIMIT 1;

DROP TRIGGER IF EXISTS company_organizational_office_reference_guard;
CREATE TRIGGER company_organizational_office_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'organizational-office' AND NEW.state = 'active' AND (
  NOT EXISTS (
    SELECT 1 FROM company_governance_organization_unit_coverage unit
    WHERE unit.organization_id = NEW.organization_id
      AND unit.organization_unit_id = json_extract(NEW.attributes_json, '$.organizationUnitId')
      AND unit.starts_on <= NEW.effective_from
      AND (unit.ends_on IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= unit.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_resource_heads position
    WHERE position.organization_id = NEW.organization_id AND position.resource_type = 'position'
      AND position.resource_id = json_extract(NEW.attributes_json, '$.positionId')
      AND position.state = 'active' AND position.effective_from <= NEW.effective_from
      AND (position.effective_to IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= position.effective_to))
  )
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

DROP TRIGGER IF EXISTS company_authority_scope_reference_guard;
CREATE TRIGGER company_authority_scope_reference_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'authority-scope' AND NEW.state = 'active' AND (
  (json_extract(NEW.attributes_json, '$.scopeType') = 'organization-unit' AND NOT EXISTS (
    SELECT 1 FROM company_governance_organization_unit_coverage unit
    WHERE unit.organization_id = NEW.organization_id
      AND unit.organization_unit_id = json_extract(NEW.attributes_json, '$.scopeId')
      AND unit.starts_on <= NEW.effective_from
      AND (unit.ends_on IS NULL OR (NEW.effective_to IS NOT NULL AND NEW.effective_to <= unit.ends_on))
  )) OR (json_extract(NEW.attributes_json, '$.scopeType') IN ('legal-entity', 'site', 'workplace') AND NOT EXISTS (
    SELECT 1 FROM company_resource_heads scoped
    WHERE scoped.organization_id = NEW.organization_id
      AND scoped.resource_type = json_extract(NEW.attributes_json, '$.scopeType')
      AND scoped.resource_id = json_extract(NEW.attributes_json, '$.scopeId') AND scoped.state = 'active'
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

DROP TRIGGER IF EXISTS company_governance_organization_revision_guard;
CREATE TRIGGER company_governance_organization_revision_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN EXISTS (
  SELECT 1 FROM company_governance_organization_reference_violations violation
  WHERE violation.organization_id = NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'company_governance_organization_reference_invalid');
END;

DROP VIEW IF EXISTS company_employment_authority_violations;
CREATE VIEW company_employment_authority_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
        AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
    )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), appointments AS (
  SELECT organization_id, resource_type, resource_id,
    json_extract(attributes_json, '$.employeeId') AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', period.organization_unit_id, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  UNION ALL
  SELECT binding.organization_id, period.employee_id, period.employment_id,
    'assignment', NULL, period.starts_on, period.ends_on
  FROM company_organization_assignment_coverage period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id, employment_id, kind, scope_id
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
), coverage AS (
  SELECT organization_id, employee_id, employment_id, kind, scope_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM islands GROUP BY organization_id, employee_id, employment_id, kind, scope_id, island
)
SELECT appointment.* FROM appointments appointment WHERE
  NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id = appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id = appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  ));

SELECT json_extract('{}', 'company_employment_authority_period_not_covered')
FROM company_employment_authority_violations LIMIT 1;

DROP TRIGGER IF EXISTS company_employment_authority_commit_guard;
CREATE TRIGGER company_employment_authority_commit_guard
AFTER UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee'
    AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations WHERE organization_id = NEW.id);
END;

DROP TRIGGER IF EXISTS company_employment_authority_projection_guard;
CREATE TRIGGER company_employment_authority_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
) AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_id = NEW.organization_id AND resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;

DROP TRIGGER IF EXISTS company_employment_authority_organization_guard;
CREATE TRIGGER company_employment_authority_organization_guard
AFTER UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED' AND NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_organizations organization ON organization.id = resource.organization_id
  WHERE resource.organization_revision > organization.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company_employment_authority_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_employment_authority_violations);
END;
