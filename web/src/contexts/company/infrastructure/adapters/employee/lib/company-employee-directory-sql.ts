import { companyEmploymentStateSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employment-state-sql"

/** 一覧と単体参照で共通の在籍・主務・組織時点を使う。?1は会社営業日。 */
export function companyEmployeeDirectorySql(): string {
  return `${companyEmploymentStateSql()},
  current_employment AS (
    SELECT employee_id, min(employment_id) AS id,
           CASE min(status) WHEN 'active' THEN 'ACTIVE' WHEN 'leave' THEN 'ON_LEAVE' END AS status,
           (count(*) = 1 AND count(status_period_id) = 1
            AND min(status_starts_on >= employment_starts_on
              AND (employment_ends_on IS NULL
                OR (status_ends_on IS NOT NULL AND status_ends_on <= employment_ends_on)))) AS is_valid
    FROM current_employment_states
    GROUP BY employee_id
    UNION ALL
    SELECT period.employee_id, period.period_id AS id, 'TERMINATED' AS status, 1 AS is_valid
    FROM latest_employment_periods AS period
    WHERE period.is_void = 0 AND period.ends_on <= ?1
      AND NOT EXISTS (
        SELECT 1 FROM current_employment_states AS current
        WHERE current.employee_id = period.employee_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM latest_employment_periods AS newer
        WHERE newer.employee_id = period.employee_id AND newer.is_void = 0 AND newer.ends_on <= ?1
          AND (newer.ends_on > period.ends_on OR (newer.ends_on = period.ends_on
            AND (newer.starts_on > period.starts_on
              OR (newer.starts_on = period.starts_on AND newer.period_id > period.period_id))))
      )
  ),
  current_assignment AS (
    SELECT assignment.employee_id,
           min(assignment.organization_unit_id) AS organization_unit_id,
           min(assignment.position_title) AS position_title,
           min(assignment.employment_id) AS employment_id,
           count(*) AS matching_count
    FROM company_organization_assignment_period_versions AS assignment
    WHERE assignment.assignment_type = 'PRIMARY'
      AND assignment.is_void = 0
      AND assignment.starts_on <= ?1
      AND (assignment.ends_on IS NULL OR ?1 < assignment.ends_on)
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_assignment_period_versions AS newer
        WHERE newer.period_id = assignment.period_id AND newer.revision > assignment.revision
      )
    GROUP BY assignment.employee_id
  ),
  current_unit AS (
    SELECT unit.organization_unit_id, min(unit.code) AS code, min(unit.official_name) AS official_name,
           count(*) AS matching_count
    FROM company_organization_unit_period_versions AS unit
    WHERE unit.is_void = 0
      AND unit.starts_on <= ?1
      AND (unit.ends_on IS NULL OR ?1 < unit.ends_on)
      AND NOT EXISTS (
        SELECT 1 FROM company_organization_unit_period_versions AS newer
        WHERE newer.period_id = unit.period_id AND newer.revision > unit.revision
      )
    GROUP BY unit.organization_unit_id
  )`
}
