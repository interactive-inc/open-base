CREATE VIEW company_account_employee_link_periods AS
WITH effective_versions AS (
  SELECT resource.*, (
    SELECT min(later.effective_from) FROM company_resource_revisions later
    WHERE later.organization_id = resource.organization_id AND later.resource_type = resource.resource_type
      AND later.resource_id = resource.resource_id AND later.effective_from > resource.effective_from
  ) AS next_from FROM company_resource_revisions resource
  WHERE resource.resource_type = 'account-employee-link' AND resource.revision = (
    SELECT max(latest.revision) FROM company_resource_revisions latest
    WHERE latest.organization_id = resource.organization_id AND latest.resource_type = resource.resource_type
      AND latest.resource_id = resource.resource_id AND latest.effective_from = resource.effective_from
  )
)
SELECT binding.account_id, binding.employee_id, resource.effective_from AS starts_on,
  CASE WHEN resource.next_from IS NULL OR (resource.effective_to IS NOT NULL AND resource.effective_to < resource.next_from)
    THEN resource.effective_to ELSE resource.next_from END AS ends_on,
  binding.resource_id, resource.revision, resource.organization_revision, 'public' AS source
FROM effective_versions resource
JOIN company_account_employee_resource_bindings binding
  ON binding.organization_id = resource.organization_id AND binding.resource_id = resource.resource_id
WHERE resource.state = 'active'
UNION ALL
SELECT original.account_id, original.employee_id, NULL, NULL, NULL, NULL, NULL, 'legacy'
FROM company_account_employee_links original
WHERE NOT EXISTS (SELECT 1 FROM company_account_employee_resource_bindings binding
  WHERE binding.account_id = original.account_id OR binding.employee_id = original.employee_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads resource WHERE resource.resource_type = 'account-employee-link'
    AND CAST(json_extract(resource.attributes_json, '$.accountId') AS TEXT) = original.account_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads resource WHERE resource.resource_type = 'account-employee-link'
    AND CAST(json_extract(resource.attributes_json, '$.employeeId') AS TEXT) = original.employee_id);
CREATE INDEX company_account_link_head_account_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.accountId') AS TEXT)) WHERE resource_type = 'account-employee-link';
CREATE INDEX company_account_link_head_employee_idx ON company_resource_heads
  (CAST(json_extract(attributes_json, '$.employeeId') AS TEXT)) WHERE resource_type = 'account-employee-link';
