import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { EmployeeCreateRequest } from "@/lib/api/types/employee-types"

/**
 * POST /company/employee-registrations。従業員を新規登録する（権限が必要）。
 * 権限不足は 403、コード重複は 409 を api が返すため、戻りは Error になる。
 */
export async function createEmployee(request: EmployeeCreateRequest) {
  const client = await createClient()

  const response = await client.company["employee-registrations"].$post(
    { json: request },
    { headers: { "Idempotency-Key": crypto.randomUUID() } },
  )

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "従業員の登録に失敗しました",
      conflictMessages: {
        "email already exists": "このメールアドレスは既に登録されています",
        "employee code already exists": "この従業員コードは既に登録されています",
      },
    })
  }

  return response.json()
}
