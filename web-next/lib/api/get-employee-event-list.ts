import { createClient } from "@/lib/api/hc-client"
import type { EmployeeEventSearchQuery } from "@/lib/api/types/employee-event-types"

/**
 * GET /company/personnel-annotations。従業員コード指定で原注記を取得する。kind で絞り込める。
 * 参照に失敗した場合はErrorを返し、空の記録として扱わない。
 */
export async function getEmployeeEventList(query: EmployeeEventSearchQuery) {
  const client = await createClient()

  const response = await client.company["personnel-annotations"].$get({
    query: {
      employee_code: query.employeeCode,
      kind: query.kind ?? undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load employee events")
  }

  const body = await response.json()

  return body.data
}
