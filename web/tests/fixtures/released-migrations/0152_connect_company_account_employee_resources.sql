DROP TRIGGER IF EXISTS company_account_employee_resource_commit_guard;
CREATE TRIGGER company_account_employee_resource_commit_guard
AFTER UPDATE OF revision ON company_organizations
BEGIN
  SELECT RAISE(ABORT, 'company account link employee is not connected') WHERE EXISTS (
    SELECT 1 FROM company_resource_heads resource
    WHERE resource.organization_id = NEW.id AND resource.resource_type = 'account-employee-link'
      AND NOT EXISTS (SELECT 1 FROM company_workforce_resource_bindings employee
        WHERE employee.organization_id = resource.organization_id AND employee.resource_type = 'employee'
          AND employee.resource_id = json_extract(resource.attributes_json, '$.employeeId'))
  );
  INSERT INTO company_account_employee_links (account_id, employee_id)
  SELECT json_extract(resource.attributes_json, '$.accountId'), json_extract(resource.attributes_json, '$.employeeId')
  FROM company_resource_heads resource WHERE resource.organization_id = NEW.id
    AND resource.resource_type = 'account-employee-link'
    AND NOT EXISTS (SELECT 1 FROM company_account_employee_links original
      WHERE original.account_id = json_extract(resource.attributes_json, '$.accountId'));
  INSERT INTO company_account_employee_resource_bindings
    (resource_id, organization_id, account_id, employee_id, recorded_at)
  SELECT resource_id, organization_id, json_extract(attributes_json, '$.accountId'),
    json_extract(attributes_json, '$.employeeId'), updated_at
  FROM company_resource_heads resource WHERE resource.organization_id = NEW.id
    AND resource.resource_type = 'account-employee-link'
    AND NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings binding WHERE binding.resource_id = resource.resource_id);
  SELECT RAISE(ABORT, 'company account link period is not covered') WHERE EXISTS (
    SELECT 1 FROM company_account_employee_link_period_violations
  );
END;
