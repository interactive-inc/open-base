DROP TRIGGER IF EXISTS company_assignment_period_bindings_update_guard;
CREATE TRIGGER company_assignment_period_bindings_update_guard
BEFORE UPDATE ON company_assignment_period_bindings
WHEN NEW.period_id != OLD.period_id OR NEW.resource_id != OLD.resource_id OR NEW.period_revision < OLD.period_revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment period source is immutable');
END;
