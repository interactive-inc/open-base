import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { EmployeeUpdateRequest } from "@/lib/api/types/employee-types"

/** PUT /employees/:code。人物台帳の氏名だけを変更する（権限が必要）。 */
export async function updateEmployee(
  code: string,
  request: EmployeeUpdateRequest,
  commandId: string,
) {
  const client = await createClient()

  const response = await client.company["employee-directory"][":code"].$put({
    param: { code },
    header: { "idempotency-key": commandId },
    json: request,
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "従業員の変更に失敗しました",
    })
  }

  return response.json()
}
