CREATE TRIGGER company_organization_change_operations_immutable
BEFORE UPDATE OF id, expected_revision, change_count, resulting_revision, recorded_at
ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is immutable');
END;
