CREATE VIEW company_reporting_reference_period_violations AS
WITH effective_versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type = 'reporting-relation' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
), next_versions AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_id ORDER BY effective_from
  ) AS next_from FROM effective_versions
), relations AS (
  SELECT organization_id, resource_id, attributes_json, effective_from AS starts_on,
    CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
      THEN effective_to ELSE next_from END AS ends_on
  FROM next_versions WHERE state = 'active'
), reporting_references AS (
  SELECT relation.organization_id, relation.resource_id, relation.starts_on, relation.ends_on,
    json_extract(reference.value, '$[0]') AS target_type,
    json_extract(reference.value, '$[1]') AS target_id
  FROM relations relation, json_each(json_array(
    json_array('employee', json_extract(attributes_json, '$.employeeId')),
    json_array('employee', json_extract(attributes_json, '$.managerEmployeeId')),
    json_array('organization-unit', json_extract(attributes_json, '$.organizationUnitId'))
  )) reference
)
SELECT reference.* FROM reporting_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

SELECT json_extract('{}', 'company_reporting_reference_period_not_covered')
FROM company_reporting_reference_period_violations LIMIT 1;

CREATE TRIGGER company_reporting_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_reporting_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_reference_period_violations WHERE organization_id = NEW.id);
END;
