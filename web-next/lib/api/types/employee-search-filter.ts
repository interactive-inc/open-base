/**
 * GET /employees のクエリ絞り込み条件。
 * status は api/src/employee/employee-search-query-input-schema.ts の enum に揃える。
 */
export type EmployeeStatusFilter = "active" | "leave" | "retired"

export type EmployeeSearchFilter = {
  q: string | null
  dept: string | null
  status: EmployeeStatusFilter | null
}
