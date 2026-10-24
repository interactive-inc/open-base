DROP TRIGGER IF EXISTS company_personnel_reporting_binding_insert_guard;
CREATE TRIGGER company_personnel_reporting_binding_insert_guard
BEFORE INSERT ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner does not match')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_resource_heads resource
    JOIN company_employments employment ON employment.id = NEW.employment_id
    WHERE resource.organization_id = NEW.organization_id AND resource.resource_type = 'reporting-relation'
      AND resource.resource_id = NEW.resource_id AND employment.employee_id = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.employeeId') = NEW.employee_id
      AND json_extract(resource.attributes_json, '$.organizationUnitId') = NEW.organization_unit_id
  );
END;
