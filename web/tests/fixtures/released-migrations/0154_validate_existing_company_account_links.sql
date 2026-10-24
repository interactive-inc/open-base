CREATE TABLE _company_account_link_period_check (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_account_link_period_check (ok)
SELECT NOT EXISTS (SELECT 1 FROM company_account_employee_link_period_violations)
  AND NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings link
    WHERE NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings employee
      WHERE employee.organization_id = link.organization_id AND employee.resource_type = 'employee'
        AND employee.resource_id = link.employee_id));
DROP TABLE _company_account_link_period_check;
