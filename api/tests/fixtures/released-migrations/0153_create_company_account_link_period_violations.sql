CREATE VIEW company_account_employee_link_period_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'employee' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (PARTITION BY organization_id, resource_id ORDER BY effective_from) AS next_from
  FROM effective_versions
), periods AS (
  SELECT organization_id, resource_id AS employee_id, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until
  FROM periods
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, employee_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island
  FROM prior
), coverage AS (
  SELECT organization_id, employee_id, min(starts_on) AS starts_on,
    CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
  FROM groups GROUP BY organization_id, employee_id, island
)
SELECT link.* FROM company_account_employee_link_periods link WHERE link.source = 'public'
  AND NOT EXISTS (SELECT 1 FROM coverage
    WHERE coverage.organization_id = 'organization:default' AND coverage.employee_id = link.employee_id
      AND coverage.starts_on <= link.starts_on
      AND (coverage.ends_on IS NULL OR (link.ends_on IS NOT NULL AND link.ends_on <= coverage.ends_on)));
