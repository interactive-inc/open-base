CREATE TRIGGER company_organization_change_operations_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE OLD.status != 'PENDING'
    OR NEW.status != 'COMPLETED'
    OR NEW.applied_count != NEW.change_count
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_lifecycle_states state
      WHERE state.id = 1 AND state.revision = NEW.resulting_revision
    );

  SELECT RAISE(ABORT, 'organization change leaves an orphan organization unit')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions child
    WHERE child.is_void = 0
      AND child.parent_organization_unit_id IS NOT NULL
      AND child.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = child.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_period_versions parent
        WHERE parent.organization_unit_id = child.parent_organization_unit_id
          AND parent.is_void = 0
          AND parent.revision = (
            SELECT max(latest.revision)
            FROM company_organization_unit_period_versions latest
            WHERE latest.period_id = parent.period_id
          )
          AND parent.starts_on <= child.starts_on
          AND (
            parent.ends_on IS NULL
            OR (child.ends_on IS NOT NULL AND child.ends_on <= parent.ends_on)
          )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NOT EXISTS (
          SELECT 1 FROM company_employments employment
          WHERE employment.id = assignment.employment_id
            AND employment.employee_id = assignment.employee_id
            AND employment.hire_date <= assignment.starts_on
            AND (
              employment.termination_date IS NULL
              OR (
                assignment.ends_on IS NOT NULL
                AND assignment.ends_on <= date(employment.termination_date, '+1 day')
              )
            )
        )
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_unit_period_versions unit
          WHERE unit.organization_unit_id = assignment.organization_unit_id
            AND unit.is_void = 0
            AND unit.revision = (
              SELECT max(latest.revision)
              FROM company_organization_unit_period_versions latest
              WHERE latest.period_id = unit.period_id
            )
            AND unit.starts_on <= assignment.starts_on
            AND (
              unit.ends_on IS NULL
              OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= unit.ends_on)
            )
        )
      )
  );

  SELECT RAISE(ABORT, 'organization change leaves an orphan responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_period_versions assignment
        WHERE assignment.employment_id = responsibility.employment_id
          AND assignment.employee_id = responsibility.employee_id
          AND assignment.organization_unit_id = responsibility.organization_unit_id
          AND assignment.is_void = 0
          AND assignment.revision = (
            SELECT max(latest.revision)
            FROM company_organization_assignment_period_versions latest
            WHERE latest.period_id = assignment.period_id
          )
          AND assignment.starts_on <= responsibility.starts_on
          AND (
            assignment.ends_on IS NULL
            OR (
              responsibility.ends_on IS NOT NULL
              AND responsibility.ends_on <= assignment.ends_on
            )
          )
      )
  );
END;
