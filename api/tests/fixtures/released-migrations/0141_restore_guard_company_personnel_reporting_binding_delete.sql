DROP TRIGGER IF EXISTS company_personnel_reporting_binding_delete_guard;
CREATE TRIGGER company_personnel_reporting_binding_delete_guard
BEFORE DELETE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;
