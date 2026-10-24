/** ?1の会社営業日に有効な雇用と状態を、各期間の最新訂正から組み合わせる。 */
export function companyEmploymentStateSql(): string {
  return `WITH ranked_workforce_resources AS (
    SELECT resource.*,
      row_number() OVER (PARTITION BY organization_id, resource_type, resource_id
        ORDER BY effective_from DESC, revision DESC) AS effective_rank
    FROM company_resource_revisions AS resource
    WHERE resource_type IN ('person', 'employee') AND effective_from <= ?1
  ),
  current_workforce_resources AS (
    SELECT * FROM ranked_workforce_resources
    WHERE effective_rank = 1 AND state = 'active' AND (effective_to IS NULL OR ?1 < effective_to)
  ),
  current_employees AS (
    SELECT binding.employee_id AS id,
      json_extract(person.attributes_json, '$.officialName') AS official_name,
      json_extract(employee.attributes_json, '$.employeeCode') AS employee_code,
      json_extract(person.attributes_json, '$.email') AS email,
      json_extract(person.attributes_json, '$.phone') AS phone
    FROM company_workforce_resource_bindings AS binding
    JOIN current_workforce_resources AS employee ON employee.organization_id = binding.organization_id
      AND employee.resource_type = 'employee' AND employee.resource_id = binding.resource_id
    JOIN current_workforce_resources AS person ON person.organization_id = employee.organization_id
      AND person.resource_type = 'person' AND person.resource_id = json_extract(employee.attributes_json, '$.personId')
    WHERE binding.resource_type = 'employee'
  ),
  latest_employment_periods AS (
    SELECT period.*
    FROM company_employment_period_versions AS period
    WHERE NOT EXISTS (
      SELECT 1 FROM company_employment_period_versions AS newer
      WHERE newer.period_id = period.period_id AND newer.revision > period.revision
    )
  ),
  latest_status_periods AS (
    SELECT period.*
    FROM company_employee_status_period_versions AS period
    WHERE NOT EXISTS (
      SELECT 1 FROM company_employee_status_period_versions AS newer
      WHERE newer.period_id = period.period_id AND newer.revision > period.revision
    )
  ),
  current_employment_states AS (
    SELECT employment.employee_id, employment.period_id AS employment_id,
           employment.starts_on AS employment_starts_on,
           employment.ends_on AS employment_ends_on,
           status.period_id AS status_period_id, status.status,
           status.starts_on AS status_starts_on, status.ends_on AS status_ends_on
    FROM latest_employment_periods AS employment
    LEFT JOIN latest_status_periods AS status
      ON status.employment_period_id = employment.period_id
     AND status.employee_id = employment.employee_id
     AND status.is_void = 0
     AND status.starts_on <= ?1
     AND (status.ends_on IS NULL OR ?1 < status.ends_on)
    WHERE employment.is_void = 0
      AND employment.starts_on <= ?1
      AND (employment.ends_on IS NULL OR ?1 < employment.ends_on)
  )`
}
