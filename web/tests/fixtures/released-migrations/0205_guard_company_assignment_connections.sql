CREATE TRIGGER company_assignment_adoption_insert_guard
BEFORE INSERT ON company_assignment_resource_adoptions
BEGIN
  SELECT RAISE(ABORT, 'assignment adoption evidence is incomplete')
  WHERE json_type(NEW.mappings_json) IS NOT 'array'
    OR (SELECT count(*) FROM json_each(NEW.mappings_json)) !=
      (SELECT count(DISTINCT json_extract(mapping.value, '$.periodId')) FROM json_each(NEW.mappings_json) mapping)
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.mappings_json) mapping
      WHERE json_type(mapping.value, '$.periodId') IS NOT 'text'
        OR json_type(mapping.value, '$.existingResourceId') IS NOT 'text'
        OR NOT EXISTS (
          SELECT 1 FROM company_organization_assignment_period_versions period
          WHERE period.period_id = json_extract(mapping.value, '$.periodId')
            AND period.recorded_by_action_id = 'assignment-adoption:' || NEW.snapshot_digest
        )
    )
    OR NEW.organization_revision != (SELECT revision FROM company_organizations WHERE id = 'organization:default')
    OR NOT EXISTS (
      SELECT 1 FROM company_organization_change_operations operation
      WHERE operation.id = 'assignment-adoption:' || NEW.snapshot_digest
        AND operation.status = 'PENDING'
        AND operation.change_count = NEW.adopted_periods
        AND operation.applied_count = NEW.adopted_periods
        AND operation.actor_account_id = NEW.actor_account_id AND operation.reason = NEW.reason
    )
    OR NEW.adopted_periods != (SELECT count(*) FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = 'assignment-adoption:' || NEW.snapshot_digest)
    OR EXISTS (
      SELECT 1 FROM company_organization_assignment_period_versions period
      WHERE period.recorded_by_action_id = 'assignment-adoption:' || NEW.snapshot_digest
        AND (period.employee_id != NEW.employee_id OR NOT EXISTS (
          SELECT 1 FROM company_assignment_period_bindings binding
          JOIN company_assignment_resource_bindings source ON source.resource_id = binding.resource_id
          JOIN company_resource_revisions applied ON applied.organization_id = source.organization_id
            AND applied.resource_type = 'assignment' AND applied.resource_id = source.resource_id
            AND applied.revision = source.resource_revision
          WHERE binding.period_id = period.period_id AND binding.period_revision = period.revision
            AND binding.source_revision = source.resource_revision AND source.employee_id = NEW.employee_id
            AND applied.organization_revision > NEW.expected_revision
            AND applied.organization_revision <= NEW.organization_revision
            AND applied.actor_account_id = NEW.actor_account_id AND applied.reason = NEW.reason
            AND (
              (source.resource_revision = 1 AND NOT EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
              ))
              OR (source.resource_revision > 1 AND EXISTS (
                SELECT 1 FROM json_each(NEW.mappings_json) mapping
                WHERE json_extract(mapping.value, '$.periodId') = period.period_id
                  AND json_extract(mapping.value, '$.existingResourceId') = source.resource_id
                  AND source.resource_revision = 1 + (
                    SELECT max(json_extract(confirmed.value, '$.revision'))
                    FROM json_each(NEW.source_json, '$.publicAssignments') confirmed
                    WHERE json_extract(confirmed.value, '$.resourceId') = source.resource_id
                      AND json_type(confirmed.value, '$.bindingEmployeeId') = 'null'
                  )
              ))
            )
        ))
    );
END;
