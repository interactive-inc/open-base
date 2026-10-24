DROP TRIGGER IF EXISTS company_assignment_period_bindings_delete_guard;
CREATE TRIGGER company_assignment_period_bindings_delete_guard
BEFORE DELETE ON company_assignment_period_bindings
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;
