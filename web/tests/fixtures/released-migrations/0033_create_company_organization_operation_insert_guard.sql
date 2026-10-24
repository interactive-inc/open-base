CREATE TRIGGER company_organization_change_operations_insert_guard
BEFORE INSERT ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization revision conflict')
  WHERE NEW.applied_count != 0
    OR NEW.status != 'PENDING'
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.expected_revision
    );
END;
