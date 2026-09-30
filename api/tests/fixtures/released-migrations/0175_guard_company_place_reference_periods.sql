CREATE VIEW company_place_reference_period_violations AS
WITH place_references AS (
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'legal-entity' AS target_type, json_extract(attributes_json, '$.legalEntityId') AS target_id
  FROM company_governance_resource_periods WHERE resource_type = 'site'
  UNION ALL
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'site', json_extract(attributes_json, '$.siteId')
  FROM company_governance_resource_periods WHERE resource_type = 'workplace'
  UNION ALL
  SELECT organization_id, resource_type, resource_id, starts_on, ends_on,
    'organization-unit', json_extract(attributes_json, '$.organizationUnitId')
  FROM company_governance_resource_periods
  WHERE resource_type = 'workplace' AND json_extract(attributes_json, '$.organizationUnitId') IS NOT NULL
)
SELECT reference.* FROM place_references reference
WHERE NOT EXISTS (
  SELECT 1 FROM company_governance_resource_coverage target
  WHERE target.organization_id = reference.organization_id AND target.resource_type = reference.target_type
    AND target.reference_id = reference.target_id AND target.starts_on <= reference.starts_on
    AND (target.ends_on IS NULL OR (reference.ends_on IS NOT NULL AND reference.ends_on <= target.ends_on))
);

SELECT json_extract('{}', 'company_place_reference_period_not_covered')
FROM company_place_reference_period_violations LIMIT 1;

CREATE TRIGGER company_place_reference_period_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_place_reference_period_not_covered')
  WHERE EXISTS (SELECT 1 FROM company_place_reference_period_violations WHERE organization_id = NEW.id);
END;

DROP TRIGGER company_site_legal_entity_guard;
CREATE TRIGGER company_site_legal_entity_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'site' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions legal_entity
    WHERE legal_entity.organization_id = NEW.organization_id AND legal_entity.resource_type = 'legal-entity'
      AND legal_entity.resource_id = json_extract(NEW.attributes_json, '$.legalEntityId')
      AND legal_entity.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_site_legal_entity_not_found');
END;

DROP TRIGGER company_workplace_site_guard;
CREATE TRIGGER company_workplace_site_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'workplace' AND NEW.state = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM company_resource_revisions site
    WHERE site.organization_id = NEW.organization_id AND site.resource_type = 'site'
      AND site.resource_id = json_extract(NEW.attributes_json, '$.siteId') AND site.state = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'company_workplace_site_not_found');
END;

DROP TRIGGER company_site_void_guard;
DROP TRIGGER company_legal_entity_void_guard;
