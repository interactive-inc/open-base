DROP TRIGGER IF EXISTS company_reporting_employment_commit_guard;
CREATE TRIGGER company_reporting_employment_commit_guard
AFTER UPDATE OF revision ON company_organizations
WHEN NOT EXISTS (
  SELECT 1 FROM company_workforce_resource_bindings binding
  JOIN company_employee_lifecycle_revisions lifecycle ON lifecycle.employee_id = binding.employee_id
  WHERE binding.organization_id = NEW.id AND binding.resource_type = 'employee'
    AND binding.lifecycle_revision != lifecycle.revision
)
BEGIN
  SELECT RAISE(ABORT, 'company reporting employment period is not covered')
  WHERE EXISTS (SELECT 1 FROM company_reporting_employment_violations WHERE organization_id = NEW.id);
END;
