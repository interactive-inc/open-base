DROP TRIGGER IF EXISTS company_workforce_projection_guard;
CREATE TRIGGER company_workforce_projection_guard
BEFORE UPDATE OF revision ON company_organizations
WHEN NEW.revision != OLD.revision
BEGIN
  SELECT RAISE(ABORT, 'company_workforce_period_conflict')
  WHERE EXISTS (
    WITH latest AS (
      SELECT period.* FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding
        ON binding.employee_id = period.employee_id AND binding.resource_type = 'employee'
        AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
    )
    SELECT 1 FROM latest AS left_period JOIN latest AS right_period
      ON left_period.employee_id = right_period.employee_id
      AND left_period.period_id < right_period.period_id
    WHERE (left_period.ends_on IS NULL OR right_period.starts_on < left_period.ends_on)
      AND (right_period.ends_on IS NULL OR left_period.starts_on < right_period.ends_on)
  );

  SELECT RAISE(ABORT, 'company_workforce_reference_period_conflict')
  WHERE EXISTS (
    WITH ranked AS (
      SELECT resource.*,
        row_number() OVER (PARTITION BY resource_type, resource_id, effective_from ORDER BY revision DESC) AS start_rank
      FROM company_resource_revisions AS resource
      WHERE organization_id = NEW.id AND resource_type IN ('person', 'employee')
    ),
    slices AS (
      SELECT resource_type, resource_id, state, attributes_json, effective_from AS starts_on,
        nullif(min(coalesce(effective_to, '9999-12-32'),
          coalesce(lead(effective_from) OVER (PARTITION BY resource_type, resource_id ORDER BY effective_from), '9999-12-32')), '9999-12-32') AS ends_on
      FROM ranked WHERE start_rank = 1
    ),
    reference_intervals AS (
      SELECT 'employee' AS reference_type, period.employee_id AS reference_id,
        period.starts_on, period.ends_on
      FROM company_employment_period_versions AS period
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.employee_id = period.employee_id AND binding.organization_id = NEW.id
      WHERE period.is_void = 0 AND NOT EXISTS (
        SELECT 1 FROM company_employment_period_versions AS newer
        WHERE newer.period_id = period.period_id AND newer.revision > period.revision
      )
      UNION ALL
      SELECT 'person', json_extract(employee.attributes_json, '$.personId'),
        employee.starts_on, employee.ends_on
      FROM slices AS employee
      JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employee'
        AND binding.resource_id = employee.resource_id AND binding.organization_id = NEW.id
      WHERE employee.resource_type = 'employee' AND employee.state = 'active'
    ),
    reference_boundaries AS (
      SELECT resource_type, resource_id, starts_on AS boundary_on FROM slices
      UNION SELECT resource_type, resource_id, ends_on FROM slices WHERE ends_on IS NOT NULL
    ),
    reference_points AS (
      SELECT reference_type, reference_id, starts_on AS effective_on FROM reference_intervals
      UNION
      SELECT reference.reference_type, reference.reference_id, boundary.boundary_on
      FROM reference_intervals AS reference JOIN reference_boundaries AS boundary
        ON boundary.resource_type = reference.reference_type AND boundary.resource_id = reference.reference_id
      WHERE reference.starts_on <= boundary.boundary_on
        AND (reference.ends_on IS NULL OR boundary.boundary_on < reference.ends_on)
    )
    SELECT 1 FROM reference_points AS reference
    WHERE NOT EXISTS (
      SELECT 1 FROM slices AS target
      WHERE target.resource_type = reference.reference_type AND target.resource_id = reference.reference_id
        AND target.state = 'active' AND target.starts_on <= reference.effective_on
        AND (target.ends_on IS NULL OR reference.effective_on < target.ends_on)
    )
  );
END;
