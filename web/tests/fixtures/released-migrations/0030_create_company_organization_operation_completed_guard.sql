CREATE TRIGGER company_organization_change_operations_completed_count_immutable
BEFORE UPDATE OF applied_count ON company_organization_change_operations
WHEN OLD.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'completed organization change operation is immutable');
END;
