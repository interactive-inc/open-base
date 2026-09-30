CREATE VIEW company_organization_resource_mismatches AS
SELECT binding.organization_unit_id
FROM company_organization_resource_bindings AS binding
JOIN company_organization_unit_period_versions AS period ON period.organization_unit_id = binding.organization_unit_id
WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
  AND NOT EXISTS (SELECT 1 FROM company_resource_heads AS head
    WHERE head.organization_id = binding.organization_id AND head.resource_type = 'organization-unit' AND head.resource_id = period.period_id
    AND head.revision = period.revision
    AND head.effective_from IS period.starts_on AND head.effective_to IS period.ends_on
    AND (head.state = 'void') = period.is_void
    AND json_extract(head.attributes_json, '$.organizationUnitId') IS period.organization_unit_id
    AND json_extract(head.attributes_json, '$.code') IS period.code
    AND json_extract(head.attributes_json, '$.officialName') IS period.official_name
    AND json_extract(head.attributes_json, '$.kind') IS period.kind
    AND json_extract(head.attributes_json, '$.parentOrganizationUnitId') IS period.parent_organization_unit_id)
UNION ALL
SELECT binding.organization_unit_id
FROM company_organization_resource_bindings AS binding
JOIN company_resource_heads AS head ON head.organization_id = binding.organization_id AND head.resource_type = 'organization-unit'
  AND json_extract(head.attributes_json, '$.organizationUnitId') = binding.organization_unit_id
WHERE NOT EXISTS (SELECT 1 FROM company_organization_unit_period_versions AS period
  WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_unit_period_versions AS latest WHERE latest.period_id = period.period_id)
    AND head.resource_id = period.period_id
    AND head.revision = period.revision
    AND head.effective_from IS period.starts_on AND head.effective_to IS period.ends_on
    AND (head.state = 'void') = period.is_void
    AND json_extract(head.attributes_json, '$.organizationUnitId') IS period.organization_unit_id
    AND json_extract(head.attributes_json, '$.code') IS period.code
    AND json_extract(head.attributes_json, '$.officialName') IS period.official_name
    AND json_extract(head.attributes_json, '$.kind') IS period.kind
    AND json_extract(head.attributes_json, '$.parentOrganizationUnitId') IS period.parent_organization_unit_id);
