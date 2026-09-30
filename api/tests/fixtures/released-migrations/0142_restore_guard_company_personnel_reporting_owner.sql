DROP TRIGGER IF EXISTS company_personnel_reporting_owner_guard;
CREATE TRIGGER company_personnel_reporting_owner_guard
BEFORE UPDATE ON company_resource_heads
WHEN OLD.resource_type = 'reporting-relation'
  AND EXISTS (SELECT 1 FROM company_personnel_reporting_bindings binding
    WHERE binding.resource_id = OLD.resource_id AND binding.organization_id = OLD.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting owner is immutable')
  WHERE NEW.organization_id IS NOT OLD.organization_id OR NEW.resource_type IS NOT OLD.resource_type
    OR NEW.resource_id IS NOT OLD.resource_id
    OR json_extract(NEW.attributes_json, '$.employeeId') IS NOT json_extract(OLD.attributes_json, '$.employeeId')
    OR json_extract(NEW.attributes_json, '$.organizationUnitId') IS NOT json_extract(OLD.attributes_json, '$.organizationUnitId');
END;
