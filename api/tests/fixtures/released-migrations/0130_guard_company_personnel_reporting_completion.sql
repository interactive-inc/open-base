DROP TRIGGER IF EXISTS company_personnel_reporting_completion_guard;
CREATE TRIGGER company_personnel_reporting_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'company personnel reporting assignment period is not covered')
  WHERE EXISTS (
    SELECT 1 FROM company_personnel_reporting_periods reporting
    WHERE NOT EXISTS (
      SELECT 1 FROM company_personnel_reporting_assignment_coverage assignment
      WHERE assignment.employee_id = reporting.employee_id AND assignment.employment_id = reporting.employment_id
        AND assignment.organization_unit_id = reporting.organization_unit_id
        AND assignment.assignment_type = reporting.assignment_type
        AND assignment.starts_on <= reporting.starts_on
        AND (assignment.ends_on IS NULL OR
          (reporting.ends_on IS NOT NULL AND reporting.ends_on <= assignment.ends_on))
    )
  );
END;
