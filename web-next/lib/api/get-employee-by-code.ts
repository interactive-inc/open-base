import { createClient } from "@/lib/api/hc-client"
import type { EmployeeDetailItem } from "@/lib/api/types/employee-list-item"

/**
 * GET /employees/:code。従業員 1 件の詳細（role 含む）を取得する。
 * 該当なし（404）は null、その他の失敗は Error を返す。
 */
export async function getEmployeeByCode(code: string): Promise<EmployeeDetailItem | null | Error> {
  const client = await createClient()

  const response = await client.company["employee-directory"][":code"].$get({
    param: { code: code },
  })

  const status: number = response.status

  if (status === 404) {
    return null
  }

  if (status >= 400) {
    return new Error("failed to load employee")
  }

  const employee = await response.json()

  return {
    code: employee.code,
    profile: employee.profile,
    profileCommandId: crypto.randomUUID(),
    name: employee.name,
    deptName: employee.dept_name,
    position: employee.position,
    email: employee.email,
    status: employee.status,
  }
}
