DROP TRIGGER IF EXISTS company_grade_assignment_owner_guard;
CREATE TRIGGER company_grade_assignment_owner_guard
BEFORE INSERT ON company_resource_revisions
WHEN NEW.resource_type = 'grade-assignment'
BEGIN
  SELECT RAISE(ABORT, 'company_grade_assignment_owner_changed') WHERE EXISTS (
    SELECT 1 FROM company_resource_revisions original
    WHERE original.organization_id = NEW.organization_id AND original.resource_type = NEW.resource_type
      AND original.resource_id = NEW.resource_id AND original.revision = 1
      AND (json_extract(original.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId')
        OR json_extract(original.attributes_json, '$.employmentId') IS NOT json_extract(NEW.attributes_json, '$.employmentId'))
  );
END;
