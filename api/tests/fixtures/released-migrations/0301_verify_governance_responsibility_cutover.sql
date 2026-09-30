CREATE TRIGGER governance_responsibility_cutover_coverage_guard
BEFORE INSERT ON company_responsibility_source_cutovers
BEGIN
  SELECT RAISE(ABORT, 'company_responsibility_source_cutover_coverage_invalid')
  WHERE NEW.source_context <> 'governance'
    OR NEW.source_kind <> 'org-role-assignment'
    OR NEW.source_count <> (SELECT count(*) FROM governance_org_role_assignments)
    OR NEW.adopted_count <> (
      SELECT count(*) FROM company_responsibility_source_adoptions
      WHERE organization_id = NEW.organization_id
        AND source_context = NEW.source_context
        AND source_kind = NEW.source_kind
        AND source_namespace = NEW.source_namespace
        AND freeze_id = NEW.freeze_id
    )
    OR EXISTS (
      SELECT 1
      FROM governance_org_role_assignments source
      LEFT JOIN company_responsibility_source_adoptions adoption
        ON adoption.organization_id = NEW.organization_id
        AND adoption.source_context = NEW.source_context
        AND adoption.source_kind = NEW.source_kind
        AND adoption.source_namespace = NEW.source_namespace
        AND adoption.freeze_id = NEW.freeze_id
        AND adoption.source_id = CAST(source.id AS TEXT)
      LEFT JOIN company_resource_revisions resource
        ON resource.organization_id = adoption.organization_id
        AND resource.resource_type = adoption.resource_type
        AND resource.resource_id = adoption.resource_id
        AND resource.revision = adoption.resource_revision
      WHERE adoption.source_id IS NULL
        OR adoption.source_version <> adoption.snapshot_digest
        OR json_extract(adoption.source_json, '$.id') IS NOT source.id
        OR json_extract(adoption.source_json, '$.org_role_code') IS NOT source.org_role_code
        OR json_extract(adoption.source_json, '$.employee_id') IS NOT CAST(source.employee_id AS TEXT)
        OR json_extract(adoption.source_json, '$.department_code') IS NOT source.department_code
        OR json_extract(adoption.source_json, '$.starts_on') IS NOT source.starts_on
        OR json_extract(adoption.source_json, '$.ends_on') IS NOT source.ends_on
        OR json_extract(adoption.source_json, '$.source_document_code') IS NOT source.source_document_code
        OR json_extract(adoption.source_json, '$.created_by_account_id') IS NOT source.created_by_account_id
        OR json_extract(adoption.source_json, '$.created_at') IS NOT source.created_at
        OR json_extract(adoption.source_json, '$.revoked_by_account_id') IS NOT source.revoked_by_account_id
        OR json_extract(adoption.source_json, '$.revoked_at') IS NOT source.revoked_at
        OR resource.resource_id IS NULL
    );
END;
