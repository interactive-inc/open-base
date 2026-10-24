SELECT json_extract('{}', 'company_organization_resource_operation_incomplete')
FROM company_command_receipts receipt
JOIN company_organizations organization ON organization.id = receipt.organization_id
JOIN company_organization_change_operations operation
  ON operation.id = 'org-resource:' || receipt.fingerprint
WHERE receipt.organization_revision <= organization.revision AND operation.status != 'COMPLETED'
LIMIT 1;

DROP TRIGGER IF EXISTS company_employments_organization_period_guard;
CREATE TRIGGER company_employments_organization_period_guard
BEFORE UPDATE OF hire_date, termination_date ON company_employments
BEGIN
  SELECT RAISE(ABORT, 'employment change would orphan an organization assignment')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.employment_id = NEW.id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        NEW.hire_date > assignment.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            assignment.ends_on IS NULL
            OR assignment.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would orphan an organization responsibility')
  WHERE EXISTS (
    SELECT 1 FROM company_organization_responsibility_period_versions responsibility
    WHERE responsibility.employment_id = NEW.id
      AND responsibility.is_void = 0
      AND responsibility.revision = (
        SELECT max(latest.revision)
        FROM company_organization_responsibility_period_versions latest
        WHERE latest.period_id = responsibility.period_id
      )
      AND (
        NEW.hire_date > responsibility.starts_on
        OR (
          NEW.termination_date IS NOT NULL
          AND (
            responsibility.ends_on IS NULL
            OR responsibility.ends_on > date(NEW.termination_date, '+1 day')
          )
        )
      )
  );

  SELECT RAISE(ABORT, 'employment change would leave an assigned employee without manager')
  WHERE NEW.termination_date IS NOT NULL AND EXISTS (
    SELECT 1 FROM company_organization_assignment_period_versions assignment
    WHERE assignment.manager_employee_id = NEW.employee_id
      AND assignment.is_void = 0
      AND assignment.revision = (
        SELECT max(latest.revision)
        FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = assignment.period_id
      )
      AND (
        assignment.ends_on IS NULL
        OR assignment.ends_on > date(NEW.termination_date, '+1 day')
      )
  );
END;

DROP TRIGGER IF EXISTS company_organization_resource_operation_commit_guard;
CREATE TRIGGER company_organization_resource_operation_commit_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'organization change operation is incomplete')
  WHERE EXISTS (
    SELECT 1 FROM company_command_receipts receipt
    JOIN company_organization_change_operations operation
      ON operation.id = 'org-resource:' || receipt.fingerprint
    WHERE receipt.organization_id = NEW.id AND receipt.organization_revision = NEW.revision
      AND operation.status != 'COMPLETED'
  );
END;
