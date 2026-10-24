DROP TRIGGER IF EXISTS company_account_employee_resource_bindings_delete_guard;
CREATE TRIGGER company_account_employee_resource_bindings_delete_guard
BEFORE DELETE ON company_account_employee_resource_bindings
BEGIN
  SELECT RAISE(ABORT, 'company account link bindings are immutable');
END;
