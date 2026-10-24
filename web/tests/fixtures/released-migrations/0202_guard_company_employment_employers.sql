CREATE VIEW company_employment_employer_reference_violations AS
SELECT employment.organization_id, employment.resource_id, employment.starts_on, employment.ends_on,
  json_extract(employment.attributes_json, '$.employerLegalEntityId') AS employer_legal_entity_id
FROM company_governance_resource_periods employment
WHERE employment.resource_type = 'employment'
  AND json_type(employment.attributes_json, '$.employerLegalEntityId') IS NOT NULL
  AND json_type(employment.attributes_json, '$.employerLegalEntityId') <> 'null'
  AND (
    json_type(employment.attributes_json, '$.employerLegalEntityId') <> 'text'
    OR NOT EXISTS (
      SELECT 1 FROM company_resource_revisions identity
      WHERE identity.organization_id = employment.organization_id
        AND identity.resource_type = 'legal-entity' AND identity.state = 'active'
        AND identity.resource_id = json_extract(employment.attributes_json, '$.employerLegalEntityId')
    )
    OR (
      json_extract(employment.attributes_json, '$.status') IN ('ACTIVE', 'ON_LEAVE')
      AND NOT EXISTS (
        SELECT 1 FROM company_governance_resource_coverage employer
        WHERE employer.organization_id = employment.organization_id AND employer.resource_type = 'legal-entity'
          AND employer.reference_id = json_extract(employment.attributes_json, '$.employerLegalEntityId')
          AND employer.starts_on <= employment.starts_on
          AND (employer.ends_on IS NULL OR (employment.ends_on IS NOT NULL AND employment.ends_on <= employer.ends_on))
      )
    )
  );

SELECT json_extract('{}', 'company_employment_employer_reference_invalid')
FROM company_employment_employer_reference_violations LIMIT 1;

CREATE TRIGGER company_employment_employer_commit_guard
BEFORE UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company_employment_employer_reference_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_employer_reference_violations WHERE organization_id = NEW.id
  );
END;
