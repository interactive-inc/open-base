DROP TRIGGER IF EXISTS company_reporting_employment_projection_guard;
CREATE TRIGGER company_reporting_employment_projection_guard
AFTER UPDATE OF lifecycle_revision ON company_workforce_resource_bindings
WHEN NEW.resource_type = 'employee' AND NEW.lifecycle_revision = (
  SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = NEW.employee_id
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations
    WHERE organization_id = NEW.organization_id AND employee_id = NEW.employee_id);
END;
