CREATE TRIGGER company_organization_change_operations_immutable_delete
BEFORE DELETE ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operations are append only');
END;
