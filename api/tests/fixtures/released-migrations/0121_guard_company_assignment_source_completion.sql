DROP TRIGGER IF EXISTS company_organization_assignment_source_completion_guard;
CREATE TRIGGER company_organization_assignment_source_completion_guard
BEFORE UPDATE OF status ON company_organization_change_operations
WHEN NEW.status = 'COMPLETED'
BEGIN
  SELECT RAISE(ABORT, 'organization assignment source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_period_bindings binding
    JOIN company_assignment_resource_bindings resource ON resource.resource_id = binding.resource_id
    JOIN company_organization_assignment_period_versions period ON period.period_id = binding.period_id
    WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
      AND (period.revision != binding.period_revision OR period.employee_id != resource.employee_id
        OR period.manager_employee_id IS NOT NULL)
  );
  SELECT RAISE(ABORT, 'organization assignment public source is stale')
  WHERE EXISTS (
    SELECT 1 FROM company_assignment_resource_bindings binding
    WHERE NOT EXISTS (
      SELECT 1 FROM company_resource_heads head WHERE head.organization_id = binding.organization_id
        AND head.resource_type = 'assignment' AND head.resource_id = binding.resource_id
        AND head.revision = binding.resource_revision
    )
  );
END;
