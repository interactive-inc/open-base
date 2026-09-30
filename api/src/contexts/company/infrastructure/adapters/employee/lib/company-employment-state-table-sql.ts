import { companyEmploymentStateSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employment-state-sql"

/**
 * ?1の会社営業日について、雇用1件につき1行の氏名・在籍状態・雇用区分の材料を返す。
 * 行は company_employments の id と employee_id を持ち、相関しない派生表として1文につき1回だけ計算される。
 * 在籍状態は従業員単位の曖昧さ（現行の雇用や状態期間が複数）をそのまま NULL にする。
 * 雇用区分は未接続の判定を呼び出し側の行ごとの式へ残すため、件数と候補値だけを返す。
 */
export function companyEmploymentStateTableSql(): string {
  return `${companyEmploymentStateSql()},
  employee_names AS (
    SELECT id AS employee_id, count(*) AS employee_count,
      CASE WHEN count(*) = 1 AND typeof(min(official_name)) = 'text'
        AND length(trim(min(official_name))) > 0 THEN min(official_name) END AS official_name
    FROM current_employees
    GROUP BY id
  ),
  employee_states AS (
    SELECT employee_id,
      CASE WHEN count(*) = 1 AND count(status_period_id) = 1
        AND min(status_starts_on >= employment_starts_on
          AND (employment_ends_on IS NULL OR (status_ends_on IS NOT NULL AND status_ends_on <= employment_ends_on)))
        THEN CASE min(status) WHEN 'active' THEN 'ACTIVE' WHEN 'leave' THEN 'ON_LEAVE' END
      END AS status
    FROM current_employment_states
    GROUP BY employee_id
  ),
  current_state_pairs AS (
    SELECT DISTINCT employee_id, employment_id FROM current_employment_states
  ),
  terminated_pairs AS (
    SELECT DISTINCT employee_id, period_id AS employment_id
    FROM latest_employment_periods
    WHERE is_void = 0 AND ends_on <= ?1
  ),
  resolved_employment_periods AS (
    SELECT period_id, employee_id,
      CASE WHEN ends_on <= ?1 THEN date(ends_on, '-1 day') ELSE ?1 END AS read_on
    FROM latest_employment_periods
    WHERE is_void = 0 AND starts_on <= ?1
  ),
  resolved_counts AS (
    SELECT period_id, employee_id, count(*) AS resolved_count
    FROM resolved_employment_periods
    GROUP BY period_id, employee_id
  ),
  ranked_employment_attributes AS (
    SELECT period.period_id, period.employee_id, period.read_on,
      resource.state, resource.effective_to, resource.attributes_json,
      row_number() OVER (
        PARTITION BY period.period_id, period.employee_id, resource.organization_id, resource.resource_id
        ORDER BY resource.effective_from DESC, resource.revision DESC) AS effective_rank
    FROM resolved_employment_periods AS period
    JOIN company_workforce_resource_bindings AS binding ON binding.resource_type = 'employment'
      AND binding.resource_id = period.period_id AND binding.employee_id = period.employee_id
    JOIN company_resource_revisions AS resource ON resource.organization_id = binding.organization_id
      AND resource.resource_type = 'employment' AND resource.resource_id = binding.resource_id
      AND resource.effective_from <= period.read_on
  ),
  employment_types AS (
    SELECT period_id, employee_id,
      CASE WHEN count(*) = 1 THEN min(json_extract(attributes_json, '$.employmentType')) END AS employment_type
    FROM ranked_employment_attributes
    WHERE effective_rank = 1 AND state = 'active'
      AND (effective_to IS NULL OR read_on < effective_to)
      AND json_extract(attributes_json, '$.employeeId') = employee_id
      AND json_extract(attributes_json, '$.employmentType') IN ('FULL_TIME', 'PART_TIME')
    GROUP BY period_id, employee_id
  ),
  employment_bindings AS (
    SELECT resource_id, count(*) AS binding_count
    FROM company_workforce_resource_bindings
    WHERE resource_type = 'employment'
    GROUP BY resource_id
  )
  SELECT employment.id AS employment_id, employment.employee_id,
    employee_name.official_name,
    CASE
      WHEN coalesce(employee_name.employee_count, 0) != 1 THEN NULL
      WHEN current_pair.employment_id IS NOT NULL THEN employee_state.status
      WHEN terminated_pair.employment_id IS NOT NULL THEN 'TERMINATED'
    END AS status,
    coalesce(resolved.resolved_count, 0) AS resolved_count,
    coalesce(binding.binding_count, 0) AS binding_count,
    employment_type.employment_type
  FROM company_employments AS employment
  LEFT JOIN employee_names AS employee_name ON employee_name.employee_id = employment.employee_id
  LEFT JOIN employee_states AS employee_state ON employee_state.employee_id = employment.employee_id
  LEFT JOIN current_state_pairs AS current_pair ON current_pair.employee_id = employment.employee_id
    AND current_pair.employment_id = employment.id
  LEFT JOIN terminated_pairs AS terminated_pair ON terminated_pair.employee_id = employment.employee_id
    AND terminated_pair.employment_id = employment.id
  LEFT JOIN resolved_counts AS resolved ON resolved.period_id = employment.id
    AND resolved.employee_id = employment.employee_id
  LEFT JOIN employment_bindings AS binding ON binding.resource_id = employment.id
  LEFT JOIN employment_types AS employment_type ON employment_type.period_id = employment.id
    AND employment_type.employee_id = employment.employee_id`
}
