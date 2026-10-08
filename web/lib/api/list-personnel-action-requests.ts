import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function listPersonnelActionRequests(targetEmployeeCode: string) {
  const client = await createClient()
  const response = await client.company["personnel-action-requests"].$get(
    {
      query: {
        target_employee_code: targetEmployeeCode,
        status: "pending",
        limit: "20",
      },
    },
    { init: { cache: "no-store" } },
  )
  if (!response.ok) {
    return toResponseError(response, { fallback: "人事変更の申請を読み込めませんでした" })
  }
  return response.json()
}

export type PersonnelActionRequests = Exclude<
  Awaited<ReturnType<typeof listPersonnelActionRequests>>,
  Error
>
