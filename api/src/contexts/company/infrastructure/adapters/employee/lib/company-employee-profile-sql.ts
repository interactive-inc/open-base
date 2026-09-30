/**
 * ?1 の会社営業日に、従業員ごとの正本から氏名、従業員 code、連絡先を読む CTE を返す。
 *
 * 公開履歴へ接続済みの従業員は、公開した Person と従業員の resource から読む。退職者と入社前の従業員も
 * 対象にするので、会社営業日に有効な版を優先し、無ければ最も新しい版を使う。最も新しい版が取消なら
 * 値は NULL になる。公開履歴へ未接続の従業員は、接続されるまで従業員の表が唯一の原記録なので表を読む。
 *
 * 利用側は最後の CTE `employee_profiles` に対して SELECT を続ける。
 */
export function companyEmployeeProfileSql(): string {
  return `WITH ranked_profiles AS (
    SELECT resource.*, row_number() OVER (
      PARTITION BY organization_id, resource_type, resource_id
      ORDER BY CASE WHEN effective_from <= ?1 AND (effective_to IS NULL OR ?1 < effective_to)
          THEN 0 ELSE 1 END,
        effective_from DESC, revision DESC) AS profile_rank
    FROM company_resource_revisions AS resource
    WHERE resource_type IN ('person', 'employee')
  ),
  profiles AS (SELECT * FROM ranked_profiles WHERE profile_rank = 1 AND state = 'active'),
  connected_employees AS (
    SELECT employee_id, organization_id, resource_id FROM company_workforce_resource_bindings
    WHERE resource_type = 'employee'
  ),
  published_employees AS (
    SELECT connected.employee_id AS id,
      json_extract(person.attributes_json, '$.officialName') AS official_name,
      json_extract(employee.attributes_json, '$.employeeCode') AS employee_code,
      json_extract(person.attributes_json, '$.email') AS email,
      json_extract(person.attributes_json, '$.phone') AS phone
    FROM connected_employees AS connected
    JOIN profiles AS employee ON employee.organization_id = connected.organization_id
      AND employee.resource_type = 'employee' AND employee.resource_id = connected.resource_id
    JOIN profiles AS person ON person.organization_id = employee.organization_id
      AND person.resource_type = 'person'
      AND person.resource_id = json_extract(employee.attributes_json, '$.personId')
  ),
  employee_profiles AS (
    SELECT employee.id,
      CASE WHEN connected.employee_id IS NULL THEN employee.employee_code
        ELSE published.employee_code END AS employee_code,
      CASE WHEN connected.employee_id IS NULL THEN employee.official_name
        ELSE published.official_name END AS official_name,
      CASE WHEN connected.employee_id IS NULL THEN employee.email ELSE published.email END AS email,
      CASE WHEN connected.employee_id IS NULL THEN employee.phone ELSE published.phone END AS phone
    FROM company_employees AS employee
    LEFT JOIN (SELECT DISTINCT employee_id FROM connected_employees) AS connected
      ON connected.employee_id = employee.id
    LEFT JOIN published_employees AS published ON published.id = employee.id
  )`
}
