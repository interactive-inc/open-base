DROP TRIGGER IF EXISTS company_assignment_employment_projection_guard;
CREATE TRIGGER company_assignment_employment_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization assignment employment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    JOIN company_assignment_period_bindings period_binding ON period_binding.period_id = assignment.period_id
    JOIN company_assignment_resource_bindings resource_binding ON resource_binding.resource_id = period_binding.resource_id
    WHERE resource_binding.organization_id = NEW.id AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions employment
        WHERE employment.period_id = assignment.employment_id
          AND employment.employee_id = assignment.employee_id AND employment.is_void = 0
          AND employment.revision = (
            SELECT max(latest.revision) FROM company_employment_period_versions latest
            WHERE latest.period_id = employment.period_id
          )
          AND employment.starts_on <= assignment.starts_on
          AND (employment.ends_on IS NULL OR
            (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employment.ends_on))
      )
  );
END;
