CREATE TABLE company_account_employee_resource_bindings (
  resource_id TEXT PRIMARY KEY NOT NULL,
  organization_id TEXT NOT NULL DEFAULT 'organization:default' CHECK (organization_id = 'organization:default'),
  resource_type TEXT NOT NULL DEFAULT 'account-employee-link' CHECK (resource_type = 'account-employee-link'),
  account_id TEXT NOT NULL UNIQUE REFERENCES system_accounts(id) ON DELETE RESTRICT,
  employee_id TEXT NOT NULL UNIQUE REFERENCES company_employees(id) ON DELETE RESTRICT,
  recorded_at INTEGER NOT NULL CHECK (recorded_at >= 0),
  FOREIGN KEY (organization_id, resource_type, resource_id)
    REFERENCES company_resource_heads(organization_id, resource_type, resource_id) ON DELETE RESTRICT
);
CREATE TABLE _company_account_link_copy_check (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _company_account_link_copy_check (ok)
SELECT NOT EXISTS (
  SELECT 1 FROM company_resource_revisions resource
  JOIN company_resource_heads head ON head.organization_id = resource.organization_id
    AND head.resource_type = resource.resource_type AND head.resource_id = resource.resource_id
  WHERE resource.resource_type = 'account-employee-link' AND (
    resource.organization_id != 'organization:default'
    OR json_extract(resource.attributes_json, '$.accountId') IS NOT json_extract(head.attributes_json, '$.accountId')
    OR json_extract(resource.attributes_json, '$.employeeId') IS NOT json_extract(head.attributes_json, '$.employeeId')
    OR EXISTS (SELECT 1 FROM company_account_employee_links original WHERE
      (original.account_id = json_extract(resource.attributes_json, '$.accountId')
        AND original.employee_id IS NOT json_extract(resource.attributes_json, '$.employeeId'))
      OR (original.employee_id = json_extract(resource.attributes_json, '$.employeeId')
        AND original.account_id IS NOT json_extract(resource.attributes_json, '$.accountId')))
  )
);
INSERT INTO company_account_employee_links (account_id, employee_id)
SELECT json_extract(head.attributes_json, '$.accountId'), json_extract(head.attributes_json, '$.employeeId')
FROM company_resource_heads head WHERE head.resource_type = 'account-employee-link'
  AND NOT EXISTS (SELECT 1 FROM company_account_employee_links original
    WHERE original.account_id = json_extract(head.attributes_json, '$.accountId'));
INSERT INTO company_account_employee_resource_bindings
  (resource_id, organization_id, account_id, employee_id, recorded_at)
SELECT resource_id, organization_id, json_extract(attributes_json, '$.accountId'),
  json_extract(attributes_json, '$.employeeId'), updated_at
FROM company_resource_heads WHERE resource_type = 'account-employee-link';
DROP TABLE _company_account_link_copy_check;
