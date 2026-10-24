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
