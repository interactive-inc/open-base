DROP TRIGGER IF EXISTS company_account_employee_resource_owner_guard;
CREATE TRIGGER company_account_employee_resource_owner_guard
BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'account-employee-link'
BEGIN
  SELECT RAISE(ABORT, 'company account link owner is immutable') WHERE
    NEW.organization_id != 'organization:default'
    OR EXISTS (SELECT 1 FROM company_resource_heads previous
      WHERE previous.organization_id = NEW.organization_id AND previous.resource_type = NEW.resource_type
        AND (previous.resource_id = NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') IS NOT json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') IS NOT json_extract(NEW.attributes_json, '$.employeeId'))
        OR previous.resource_id != NEW.resource_id AND (
          json_extract(previous.attributes_json, '$.accountId') = json_extract(NEW.attributes_json, '$.accountId')
          OR json_extract(previous.attributes_json, '$.employeeId') = json_extract(NEW.attributes_json, '$.employeeId'))))
    OR EXISTS (SELECT 1 FROM company_account_employee_links original WHERE
      original.account_id = json_extract(NEW.attributes_json, '$.accountId') AND original.employee_id IS NOT json_extract(NEW.attributes_json, '$.employeeId')
      OR original.employee_id = json_extract(NEW.attributes_json, '$.employeeId') AND original.account_id IS NOT json_extract(NEW.attributes_json, '$.accountId'));
  SELECT RAISE(ABORT, 'company account link account is missing') WHERE NOT EXISTS (
    SELECT 1 FROM system_accounts WHERE id = json_extract(NEW.attributes_json, '$.accountId')
  );
END;
