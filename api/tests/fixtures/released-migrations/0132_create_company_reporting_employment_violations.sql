CREATE VIEW company_reporting_employment_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'reporting-relation' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), relations AS (
  SELECT organization_id, resource_id, attributes_json, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), participants AS (
  SELECT organization_id, resource_id, starts_on, ends_on,
    json_extract(attributes_json, '$.employeeId') AS employee_id FROM relations
  UNION ALL
  SELECT organization_id, resource_id, starts_on, ends_on,
    json_extract(attributes_json, '$.managerEmployeeId') AS employee_id FROM relations
), heads AS (
  SELECT binding.organization_id, period.employee_id, period.starts_on, period.ends_on
  FROM company_employment_period_versions period
  JOIN company_workforce_resource_bindings binding
    ON binding.resource_type = 'employee' AND binding.resource_id = period.employee_id
  WHERE period.is_void = 0 AND period.revision = (SELECT max(latest.revision)
    FROM company_employment_period_versions latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
), coverage AS (
  SELECT organization_id, employee_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM groups GROUP BY organization_id, employee_id, island
)
SELECT participant.* FROM participants participant WHERE NOT EXISTS (
  SELECT 1 FROM coverage WHERE coverage.organization_id = participant.organization_id
    AND coverage.employee_id = participant.employee_id AND coverage.starts_on <= participant.starts_on
    AND (coverage.ends_on IS NULL OR
      (participant.ends_on IS NOT NULL AND participant.ends_on <= coverage.ends_on))
);
