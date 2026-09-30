CREATE VIEW company_organization_unit_coverage AS
WITH heads AS (
  SELECT organization_unit_id, starts_on, ends_on FROM company_organization_unit_period_versions AS period
  WHERE is_void = 0 AND revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
), prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (PARTITION BY organization_unit_id ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS covered_until FROM heads
), groups AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (PARTITION BY organization_unit_id ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING) AS island FROM prior
)
SELECT organization_unit_id, min(starts_on) AS starts_on, CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM groups GROUP BY organization_unit_id, island;
