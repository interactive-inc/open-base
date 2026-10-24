DROP TRIGGER IF EXISTS company_assignment_resource_bindings_delete_guard;
CREATE TRIGGER company_assignment_resource_bindings_delete_guard
BEFORE DELETE ON company_assignment_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source identity is immutable');
END;
