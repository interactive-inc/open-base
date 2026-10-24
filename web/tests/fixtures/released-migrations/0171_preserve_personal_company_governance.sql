WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority',
      'responsibility-assignment', 'collective-body-membership')
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
    CASE WHEN resource_type = 'responsibility-assignment'
      THEN json_extract(attributes_json, '$.holderId')
      ELSE json_extract(attributes_json, '$.employeeId') END AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
    AND (resource_type != 'responsibility-assignment' OR json_extract(attributes_json, '$.holderType') = 'employee')
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, NULL AS employment_id,
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
SELECT json_extract('{}', 'company_personal_governance_period_not_covered')
FROM appointments appointment WHERE
  NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  )) LIMIT 1;

DROP VIEW IF EXISTS company_employment_authority_violations;
CREATE VIEW company_employment_authority_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('office-assignment', 'organizational-authority',
      'responsibility-assignment', 'collective-body-membership')
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
    CASE WHEN resource_type = 'responsibility-assignment'
      THEN json_extract(attributes_json, '$.holderId')
      ELSE json_extract(attributes_json, '$.employeeId') END AS employee_id,
    json_extract(attributes_json, '$.employmentId') AS employment_id,
    json_extract(attributes_json, '$.scopeType') AS scope_type,
    json_extract(attributes_json, '$.scopeId') AS scope_id,
    effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
    AND (resource_type != 'responsibility-assignment' OR json_extract(attributes_json, '$.holderType') = 'employee')
), periods AS (
  SELECT binding.organization_id, period.employee_id, period.period_id AS employment_id,
    'employment' AS kind, NULL AS scope_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
  UNION ALL
  SELECT binding.organization_id, period.employee_id, NULL AS employment_id,
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
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'employment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
  ) OR (appointment.resource_type = 'organizational-authority' AND NOT EXISTS (
    SELECT 1 FROM coverage WHERE coverage.organization_id = appointment.organization_id
      AND coverage.employee_id = appointment.employee_id AND coverage.employment_id IS appointment.employment_id
      AND coverage.kind = 'assignment' AND coverage.starts_on <= appointment.starts_on
      AND (coverage.ends_on IS NULL OR (appointment.ends_on IS NOT NULL AND appointment.ends_on <= coverage.ends_on))
      AND ((appointment.scope_type = 'organization-unit' AND coverage.scope_id = appointment.scope_id)
        OR (appointment.scope_type = 'authority-scope' AND coverage.scope_id IS NULL))
  ));
