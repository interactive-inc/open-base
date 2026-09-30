type Context = D1Database

export type RegisteredEmployeeByOperation = Readonly<{
  kind: string
  payloadFingerprint: string
  recordedByAccountId: string | null
  employeeCode: string
  officialName: string
  accountId: string
}>

/** 冪等keyで確定済みの入社発令と、登録時に公開した従業員の値、対応するAccountを返す。再送の照合に使う。 */
export class FindRegisteredEmployeeByOperationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(operationId: string): Promise<RegisteredEmployeeByOperation | null | Error> {
    try {
      const row = await this.c
        .prepare(
          // 登録の command が公開した版と照合する。登録後の改名や表の列に左右されない。
          `SELECT action.kind, action.payload_fingerprint, action.recorded_by_account_id,
                json_extract(employee.attributes_json, '$.employeeCode') AS employee_code,
                json_extract(person.attributes_json, '$.officialName') AS official_name,
                link.account_id
           FROM company_personnel_actions AS action
           JOIN company_resource_revisions AS employee ON employee.resource_type = 'employee'
             AND employee.resource_id = action.employee_id
             AND employee.command_id = 'initial-workforce:' || action.id
           JOIN company_resource_revisions AS person ON person.organization_id = employee.organization_id
             AND person.resource_type = 'person'
             AND person.resource_id = json_extract(employee.attributes_json, '$.personId')
             AND person.command_id = employee.command_id
           JOIN company_account_employee_resource_bindings AS link ON link.employee_id = action.employee_id
          WHERE action.operation_id = ?1`,
        )
        .bind(operationId)
        .first<{
          kind: string
          payload_fingerprint: string
          recorded_by_account_id: string | null
          employee_code: string
          official_name: string
          account_id: string
        }>()
      if (row === null) return null
      return {
        kind: row.kind,
        payloadFingerprint: row.payload_fingerprint,
        recordedByAccountId: row.recorded_by_account_id,
        employeeCode: row.employee_code,
        officialName: row.official_name,
        accountId: row.account_id,
      }
    } catch (cause) {
      return new Error("registered employee is unavailable", { cause })
    }
  }
}
