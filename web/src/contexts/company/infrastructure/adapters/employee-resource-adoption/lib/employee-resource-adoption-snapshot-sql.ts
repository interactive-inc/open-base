import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
/** 移行の参照と保存直前の照合で、同じ行・列・順序を使用する。 */
export function employeeResourceAdoptionSnapshotSql(
  scope: "one" | "batch" | "guard" = "one",
): string {
  const filters = {
    one: "employee.id = ?1",
    batch: "employee.id IN (SELECT value FROM json_each(?1)) ORDER BY employee.id",
    guard: "employee.id = json_extract(expected.value, '$.employeeId')",
  }
  return `SELECT json_object(
    'organizationRevision', (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'),
    'employee', json_object('id', employee.id, 'officialName', employee.official_name,
      'employeeCode', employee.employee_code, 'email', employee.email, 'phone', employee.phone,
      'createdAt', employee.created_at, 'updatedAt', employee.updated_at),
    'lifecycleRevision', (SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = employee.id),
    'employments', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('id', id, 'employeeId', employee_id, 'contractName', contract_name,
        'employmentType', employment_type, 'hireDate', hire_date, 'terminationDate', termination_date,
        'status', status, 'createdAt', created_at, 'updatedAt', updated_at) AS row_json
      FROM company_employments WHERE employee_id = employee.id ORDER BY id))),
    'employmentPeriods', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('periodId', period_id, 'revision', revision, 'employeeId', employee_id,
        'startsOn', starts_on, 'endsOn', ends_on, 'isVoid', is_void,
        'recordedByActionId', recorded_by_action_id, 'recordedAt', recorded_at) AS row_json
      FROM company_employment_period_versions WHERE employee_id = employee.id
        OR period_id IN (SELECT id FROM company_employments WHERE employee_id = employee.id) ORDER BY period_id, revision))),
    'statusPeriods', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('periodId', period_id, 'revision', revision, 'employeeId', employee_id,
        'employmentPeriodId', employment_period_id, 'status', status,
        'startsOn', starts_on, 'endsOn', ends_on, 'isVoid', is_void,
        'recordedByActionId', recorded_by_action_id, 'recordedAt', recorded_at) AS row_json
      FROM company_employee_status_period_versions WHERE employee_id = employee.id
        OR employment_period_id IN (SELECT id FROM company_employments WHERE employee_id = employee.id) ORDER BY period_id, revision))),
    'accounts', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('accountId', link.account_id, 'displayName', profile.display_name,
        'createdAt', profile.created_at, 'updatedAt', profile.updated_at) AS row_json
      FROM company_account_employee_links AS link LEFT JOIN company_account_profiles AS profile
        ON profile.account_id = link.account_id AND profile.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'
      WHERE link.employee_id = employee.id ORDER BY link.account_id))),
    'bindings', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('resourceType', resource_type, 'resourceId', resource_id, 'organizationId', organization_id,
        'resourceRevision', resource_revision, 'lifecycleRevision', lifecycle_revision, 'lastActionId', last_action_id) AS row_json
      FROM company_workforce_resource_bindings WHERE employee_id = employee.id ORDER BY resource_type, resource_id))),
    'publicResources', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('organizationId', resource.organization_id, 'type', resource.resource_type,
        'id', resource.resource_id, 'revision', resource.revision, 'state', resource.state,
        'effectiveFrom', resource.effective_from, 'effectiveTo', resource.effective_to,
        'attributes', json(resource.attributes_json), 'organizationRevision', resource.organization_revision,
        'commandId', resource.command_id, 'actorAccountId', resource.actor_account_id,
        'reason', resource.reason, 'recordedAt', resource.recorded_at) AS row_json
      FROM company_resource_revisions resource WHERE resource.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND (
        (resource.resource_type = 'employee' AND resource.resource_id = employee.id)
        OR (resource.resource_type = 'employment' AND resource.resource_id IN (
          SELECT id FROM company_employments WHERE employee_id = employee.id))
        OR (resource.resource_type = 'person' AND resource.resource_id IN (
          SELECT json_extract(attributes_json, '$.personId') FROM company_resource_revisions
          WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'employee' AND resource_id = employee.id))
      ) ORDER BY resource.resource_type, resource.resource_id, resource.revision))),
    'publicHeads', json((SELECT json_group_array(json(row_json)) FROM (
      SELECT json_object('organizationId', resource.organization_id, 'type', resource.resource_type,
        'id', resource.resource_id, 'revision', resource.revision, 'state', resource.state,
        'effectiveFrom', resource.effective_from, 'effectiveTo', resource.effective_to,
        'attributes', json(resource.attributes_json)) AS row_json
      FROM company_resource_heads resource WHERE resource.organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND (
        (resource.resource_type = 'employee' AND resource.resource_id = employee.id)
        OR (resource.resource_type = 'employment' AND resource.resource_id IN (
          SELECT id FROM company_employments WHERE employee_id = employee.id))
        OR (resource.resource_type = 'person' AND resource.resource_id IN (
          SELECT json_extract(attributes_json, '$.personId') FROM company_resource_revisions
          WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'employee' AND resource_id = employee.id))
      ) ORDER BY resource.resource_type, resource.resource_id)))
  ) AS snapshot_json FROM company_employees AS employee WHERE ${filters[scope]}`
}
