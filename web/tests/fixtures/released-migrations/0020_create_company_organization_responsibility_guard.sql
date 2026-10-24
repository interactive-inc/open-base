CREATE TRIGGER company_organization_responsibility_period_versions_guard
BEFORE INSERT ON company_organization_responsibility_period_versions
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is missing or stale')
  WHERE NOT EXISTS (
    SELECT 1
    FROM company_organization_change_operations operation
    JOIN company_organization_lifecycle_states state ON state.id = 1
    WHERE operation.id = NEW.recorded_by_action_id
      AND operation.status = 'PENDING'
      AND operation.applied_count < operation.change_count
      AND state.revision = operation.expected_revision + operation.applied_count
  );

  SELECT RAISE(ABORT, 'organization responsibility revision is not sequential')
  WHERE NEW.revision != coalesce(
    (
      SELECT max(revision)
      FROM company_organization_responsibility_period_versions
      WHERE period_id = NEW.period_id
    ),
    0
  ) + 1;

  SELECT RAISE(ABORT, 'organization responsibility owner is immutable')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions previous
    WHERE previous.period_id = NEW.period_id
      AND (
        previous.employment_id != NEW.employment_id
        OR previous.employee_id != NEW.employee_id
        OR previous.organization_unit_id != NEW.organization_unit_id
        OR previous.responsibility_type != NEW.responsibility_type
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility employment mismatch')
  WHERE NOT EXISTS (
    SELECT 1 FROM company_employments employment
    WHERE employment.id = NEW.employment_id
      AND employment.employee_id = NEW.employee_id
      AND employment.hire_date <= NEW.starts_on
      AND (
        employment.termination_date IS NULL
        OR (
          NEW.ends_on IS NOT NULL
          AND NEW.ends_on <= date(employment.termination_date, '+1 day')
        )
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility unit is not active')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_unit_period_versions unit
    WHERE unit.organization_unit_id = NEW.organization_unit_id
      AND unit.is_void = 0
      AND unit.revision = (
        SELECT max(latest.revision)
        FROM company_organization_unit_period_versions latest
        WHERE latest.period_id = unit.period_id
      )
      AND unit.starts_on <= NEW.starts_on
      AND (
        unit.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= unit.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility requires matching assignment')
  WHERE NEW.is_void = 0 AND NOT EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.employment_id
      AND assignment.employee_id = NEW.employee_id
      AND assignment.organization_unit_id = NEW.organization_unit_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND assignment.starts_on <= NEW.starts_on
      AND (
        assignment.ends_on IS NULL
        OR (NEW.ends_on IS NOT NULL AND NEW.ends_on <= assignment.ends_on)
      )
  );

  SELECT RAISE(ABORT, 'organization responsibility overlaps')
  WHERE NEW.is_void = 0 AND EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions current
    WHERE current.period_id != NEW.period_id
      AND current.employee_id = NEW.employee_id
      AND current.organization_unit_id = NEW.organization_unit_id
      AND current.responsibility_type = NEW.responsibility_type
      AND current.is_void = 0
      AND current.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = current.period_id
      )
      AND (current.ends_on IS NULL OR NEW.starts_on < current.ends_on)
      AND (NEW.ends_on IS NULL OR current.starts_on < NEW.ends_on)
  );
END;
