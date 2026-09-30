CREATE VIEW company_grade_assignment_periods AS
WITH versions AS (
  SELECT resource.* FROM company_resource_revisions resource
  WHERE resource.resource_type IN ('employee', 'employment', 'grade', 'grade-assignment')
    AND resource.revision = (
      SELECT max(latest.revision) FROM company_resource_revisions latest
      WHERE latest.organization_id = resource.organization_id
        AND latest.resource_type = resource.resource_type AND latest.resource_id = resource.resource_id
        AND latest.effective_from = resource.effective_from
    )
), boundaries AS (
  SELECT *, lead(effective_from) OVER (
    PARTITION BY organization_id, resource_type, resource_id ORDER BY effective_from
  ) AS next_from FROM versions
)
SELECT organization_id, resource_type, resource_id, attributes_json,
  effective_from AS starts_on,
  CASE WHEN next_from IS NULL OR (effective_to IS NOT NULL AND effective_to < next_from)
    THEN effective_to ELSE next_from END AS ends_on
FROM boundaries WHERE state = 'active'
  AND (resource_type != 'employment' OR json_extract(attributes_json, '$.status') != 'TERMINATED');

CREATE VIEW company_grade_assignment_coverage AS
WITH prior AS (
  SELECT *, max(coalesce(ends_on, '9999-12-31')) OVER (
    PARTITION BY organization_id, resource_type, resource_id, json_extract(attributes_json, '$.employeeId')
    ORDER BY starts_on, ends_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ) AS covered_until FROM company_grade_assignment_periods
), islands AS (
  SELECT *, sum(CASE WHEN covered_until IS NULL OR starts_on > covered_until THEN 1 ELSE 0 END) OVER (
    PARTITION BY organization_id, resource_type, resource_id, json_extract(attributes_json, '$.employeeId')
    ORDER BY starts_on, ends_on ROWS UNBOUNDED PRECEDING
  ) AS island FROM prior
)
SELECT organization_id, resource_type, resource_id,
  json_extract(attributes_json, '$.employeeId') AS employee_id, min(starts_on) AS starts_on,
  CASE WHEN max(ends_on IS NULL) = 1 THEN NULL ELSE max(ends_on) END AS ends_on
FROM islands GROUP BY organization_id, resource_type, resource_id, employee_id, island;

CREATE VIEW company_grade_assignment_violations AS
SELECT assignment.organization_id, assignment.resource_id
FROM company_grade_assignment_periods assignment
WHERE assignment.resource_type = 'grade-assignment' AND (
  NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage employee
    WHERE employee.organization_id = assignment.organization_id AND employee.resource_type = 'employee'
      AND employee.resource_id = json_extract(assignment.attributes_json, '$.employeeId')
      AND employee.starts_on <= assignment.starts_on
      AND (employee.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employee.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage employment
    WHERE employment.organization_id = assignment.organization_id AND employment.resource_type = 'employment'
      AND employment.resource_id = json_extract(assignment.attributes_json, '$.employmentId')
      AND employment.employee_id = json_extract(assignment.attributes_json, '$.employeeId')
      AND employment.starts_on <= assignment.starts_on
      AND (employment.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= employment.ends_on))
  ) OR NOT EXISTS (
    SELECT 1 FROM company_grade_assignment_coverage grade
    WHERE grade.organization_id = assignment.organization_id AND grade.resource_type = 'grade'
      AND grade.resource_id = json_extract(assignment.attributes_json, '$.gradeId')
      AND grade.starts_on <= assignment.starts_on
      AND (grade.ends_on IS NULL OR (assignment.ends_on IS NOT NULL AND assignment.ends_on <= grade.ends_on))
  ) OR EXISTS (
    SELECT 1 FROM company_grade_assignment_periods other
    WHERE other.organization_id = assignment.organization_id AND other.resource_type = 'grade-assignment'
      AND other.resource_id != assignment.resource_id
      AND json_extract(other.attributes_json, '$.employmentId') = json_extract(assignment.attributes_json, '$.employmentId')
      AND (other.ends_on IS NULL OR assignment.starts_on < other.ends_on)
      AND (assignment.ends_on IS NULL OR other.starts_on < assignment.ends_on)
  )
);

SELECT json_extract('{}', 'company_grade_assignment_invalid')
FROM company_grade_assignment_violations LIMIT 1;
