/**
 * 公開束縛が欠けた従業員の有無を読む1文。呼び出し側の読取と同じbatchの先頭に置き、
 * 別の往復を増やさずに同じ時点の状態で検査する。結果は checkPublicEmployeeBindings で判定する。
 */
export function publicEmployeeBindingStatement(database: D1Database): D1PreparedStatement {
  return database.prepare(`SELECT 1 AS missing FROM company_employees AS employee
    WHERE NOT EXISTS (
      SELECT 1 FROM company_workforce_resource_bindings AS binding
      WHERE binding.resource_type = 'employee' AND binding.employee_id = employee.id
    )
    LIMIT 1`)
}
