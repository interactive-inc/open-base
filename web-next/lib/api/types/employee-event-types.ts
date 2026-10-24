/** 異動・在籍イベントの種別。join=入社 / transfer=異動 / leave_of_absence=休職 / return=復職 / retire=退職。 */
export type EmployeeEventKind = "join" | "transfer" | "leave_of_absence" | "return" | "retire"

/** GET /company/personnel-annotations のレスポンス要素。api は snake_case で返す。 */
export type EmployeeEventResponse = {
  id: string
  employee_id: string
  kind: string
  effective_date: string
  from_department_code: string | null
  to_department_code: string | null
  note: string | null
  created_at: string
}

/** GET /company/personnel-annotations のクエリ。employee_code で対象を指定し、kind で絞り込める。 */
export type EmployeeEventSearchQuery = {
  employeeCode: string
  kind: EmployeeEventKind | null
}
