import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"

/** api/src/employee/employee-response-schema.ts と同形の手書き type。 */
export type EmployeeResponse = {
  code: string
  name: string
  dept_name: string | null
  position: string | null
  email: string
  status: string
  role: "member" | "manager" | "hr" | "root"
}

/** 在籍状況。api の status enum と同形。 */
export type EmployeeStatus = "active" | "leave" | "retired"

/** ロール。api の role enum と同形。 */
export type EmployeeRole = "member" | "manager" | "hr" | "root"

/** POST /employees のリクエストボディ。 */
export type EmployeeCreateRequest = {
  expected_company_revision: number
  code: string
  name: string
  email: string
  password: string
  role: "member" | "manager" | "hr" | "root"
  hire_on: string
  employment_type: "FULL_TIME" | "PART_TIME"
  department_code?: string | null
  position_code?: string | null
  manager_employee_code?: string | null
}

/** PUT /employees/:code のリクエストボディ。所属・役職・在籍状態は人事発令で扱う。 */
export type EmployeeUpdateRequest = {
  profile: EmployeeProfileVersion
  reason: string
  name: string
}
