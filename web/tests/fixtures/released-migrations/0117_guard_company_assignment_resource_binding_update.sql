DROP TRIGGER IF EXISTS company_assignment_resource_bindings_update_guard;
CREATE TRIGGER company_assignment_resource_bindings_update_guard
BEFORE UPDATE ON company_assignment_resource_bindings
WHEN NEW.resource_id != OLD.resource_id OR NEW.organization_id != OLD.organization_id
  OR NEW.employee_id != OLD.employee_id OR NEW.resource_revision < OLD.resource_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;
