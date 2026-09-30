DROP TRIGGER IF EXISTS company_personnel_reporting_binding_update_guard;
CREATE TRIGGER company_personnel_reporting_binding_update_guard
BEFORE UPDATE ON company_personnel_reporting_bindings
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting binding is immutable');
END;
