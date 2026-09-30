CREATE VIEW company_personnel_reporting_periods AS
WITH effective_versions AS (
  SELECT resource.*, binding.employee_id, binding.employment_id, binding.organization_unit_id, binding.assignment_type
  FROM company_resource_revisions resource
  JOIN company_personnel_reporting_bindings binding
    ON binding.organization_id = resource.organization_id AND resource.resource_type = 'reporting-relation'
      AND binding.resource_id = resource.resource_id
  WHERE resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
)
SELECT organization_id, resource_id, employee_id, employment_id, organization_unit_id, assignment_type,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM next_versions WHERE state = 'active';

CREATE VIEW company_personnel_reporting_assignment_coverage AS
WITH heads AS (
  SELECT employment_id, employee_id, organization_unit_id, assignment_type, starts_on, ends_on
  FROM company_organization_assignment_period_versions period
  JOIN company_assignment_period_bindings binding ON binding.period_id = period.period_id
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision)
    FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY employment_id, employee_id, organization_unit_id, assignment_type
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY employment_id, employee_id, organization_unit_id, assignment_type
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
)
SELECT employment_id, employee_id, organization_unit_id, assignment_type, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY employment_id, employee_id, organization_unit_id, assignment_type, island;
