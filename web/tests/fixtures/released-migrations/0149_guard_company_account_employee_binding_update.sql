DROP TRIGGER IF EXISTS company_account_employee_resource_bindings_update_guard;
CREATE TRIGGER company_account_employee_resource_bindings_update_guard
BEFORE UPDATE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;
