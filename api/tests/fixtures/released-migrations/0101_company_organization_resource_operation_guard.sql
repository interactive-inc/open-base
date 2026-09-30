DROP TRIGGER IF EXISTS company_organization_resource_operation_guard;
CREATE TRIGGER company_organization_resource_operation_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization resource history mismatch')
  WHERE EXISTS (SELECT 1 FROM company_organization_resource_mismatches);
END;
