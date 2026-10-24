import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = Readonly<{ database: D1Database }>

/** 従業員番号は可変。公開対応と移行中の旧対応が指す従業員を保存直前に再検査する。 */
const snapshotSql = `SELECT json_array(
  (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1),
  (SELECT count(*) FROM company_organization_change_operations WHERE status = 'PENDING'),
  (SELECT count(*) FROM company_employment_period_versions),
  (SELECT count(*) FROM company_employee_status_period_versions),
  (SELECT count(*) FROM company_organization_unit_period_versions),
  (SELECT count(*) FROM company_organization_assignment_period_versions),
  (SELECT count(*) FROM company_organization_responsibility_period_versions),
  (SELECT count(*) FROM company_personnel_actions),
  (SELECT count(*) FROM company_account_employee_links),
  (SELECT count(*) FROM company_account_employee_resource_bindings),
  (SELECT count(*) FROM company_resource_revisions),
  (SELECT json_group_array(json_array(resource_type, resource_id, organization_id,
    employee_id, resource_revision, lifecycle_revision, last_action_id)) FROM (
    SELECT * FROM company_workforce_resource_bindings
    WHERE employee_id IN (
      SELECT employee_id FROM company_account_employee_resource_bindings
      WHERE account_id IN (SELECT value FROM json_each(?1, '$.accountIds'))
      UNION
      SELECT employee_id FROM company_account_employee_links
      WHERE account_id IN (SELECT value FROM json_each(?1, '$.accountIds'))
    ) ORDER BY resource_type, resource_id
  )),
  (SELECT count(*) FROM company_employees),
  (SELECT json_group_array(json_array(id, employee_code)) FROM (
    SELECT id, employee_code FROM company_employees
    WHERE employee_code IN (SELECT value FROM json_each(?1, '$.employeeCodes'))
      OR id IN (
        SELECT employee_id FROM company_account_employee_resource_bindings
        WHERE account_id IN (SELECT value FROM json_each(?1, '$.accountIds'))
        UNION
        SELECT employee_id FROM company_account_employee_links
        WHERE account_id IN (SELECT value FROM json_each(?1, '$.accountIds'))
      )
    ORDER BY id
  ))
) AS snapshot`

/** Companyの資格参照とSystemの判断保存の間に起きた変更を、同じbatch内で拒否する。 */
export class CompanyAuthoritySnapshotGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findSnapshot(): Promise<string | Error> {
    try {
      const snapshot = await this.c.database
        .prepare(snapshotSql)
        .bind(JSON.stringify({ employeeCodes: [], accountIds: [] }))
        .first<string>("snapshot")
      return snapshot ?? new Error("Company authority snapshot is unavailable")
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("Company authority snapshot is unavailable")
    }
  }

  async prepare(
    input: Readonly<{
      employeeCodes: ReadonlyArray<string>
      accountIds: ReadonlyArray<AccountId>
    }>,
  ): Promise<D1PreparedStatement | Error> {
    try {
      const references = JSON.stringify({
        employeeCodes: [...new Set(input.employeeCodes)].sort(),
        accountIds: [...new Set(input.accountIds)].sort(),
      })
      const snapshot = await this.c.database
        .prepare(snapshotSql)
        .bind(references)
        .first<string>("snapshot")

      if (snapshot === null) return new Error("Company authority snapshot is unavailable")

      return this.c.database
        .prepare(`SELECT CASE WHEN snapshot = ?2 THEN 1 ELSE json_extract('', '$') END AS ok
          FROM (${snapshotSql})`)
        .bind(references, snapshot)
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to capture Company authority snapshot", { cause })
    }
  }
}
