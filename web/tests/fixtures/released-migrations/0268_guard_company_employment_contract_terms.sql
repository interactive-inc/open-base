CREATE VIEW company_employment_contract_term_violations AS
SELECT organization_id, resource_id, revision
FROM company_resource_revisions
WHERE resource_type = 'employment'
  AND json_type(attributes_json, '$.contractTerm') IS NOT NULL
  AND json_type(attributes_json, '$.contractTerm') <> 'null'
  AND NOT coalesce(
    json_type(attributes_json, '$.contractTerm') = 'object'
    AND json_type(attributes_json, '$.contractTerm.kind') = 'text'
    AND json_type(attributes_json, '$.contractTerm.startsOn') = 'text'
    AND json_extract(attributes_json, '$.contractTerm.startsOn') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
    AND date(json_extract(attributes_json, '$.contractTerm.startsOn'), '+0 days') = json_extract(attributes_json, '$.contractTerm.startsOn')
    AND (
      (
        json_extract(attributes_json, '$.contractTerm.kind') = 'INDEFINITE'
        AND (SELECT count(*) FROM json_each(attributes_json, '$.contractTerm')) = 2
        AND NOT EXISTS (SELECT 1 FROM json_each(attributes_json, '$.contractTerm') WHERE key NOT IN ('kind', 'startsOn'))
      )
      OR (
        json_extract(attributes_json, '$.contractTerm.kind') = 'FIXED_TERM'
        AND (SELECT count(*) FROM json_each(attributes_json, '$.contractTerm')) = 3
        AND NOT EXISTS (SELECT 1 FROM json_each(attributes_json, '$.contractTerm') WHERE key NOT IN ('kind', 'startsOn', 'endsBefore'))
        AND json_type(attributes_json, '$.contractTerm.endsBefore') = 'text'
        AND json_extract(attributes_json, '$.contractTerm.endsBefore') GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(json_extract(attributes_json, '$.contractTerm.endsBefore'), '+0 days') = json_extract(attributes_json, '$.contractTerm.endsBefore')
        AND json_extract(attributes_json, '$.contractTerm.startsOn') < json_extract(attributes_json, '$.contractTerm.endsBefore')
      )
    ), 0
  );

SELECT json_extract('{}', 'company_employment_contract_term_invalid')
FROM company_employment_contract_term_violations LIMIT 1;

CREATE TRIGGER company_employment_contract_term_insert_guard
AFTER INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'employment'
BEGIN
  SELECT RAISE(ABORT, 'company_employment_contract_term_invalid')
  WHERE EXISTS (
    SELECT 1 FROM company_employment_contract_term_violations
    WHERE organization_id = NEW.organization_id AND resource_id = NEW.resource_id AND revision = NEW.revision
  );
END;
