import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function getEmployeeLifecycleState(code: string, asOf?: string) {
  const client = await createClient()
  const response = await client.company["employee-lifecycle"][":code"].state.$get(
    { param: { code }, query: { as_of: asOf } },
    { init: { cache: "no-store" } },
  )
  if (!response.ok) {
    return toResponseError(response, { fallback: "人事状態の取得に失敗しました" })
  }
  return response.json()
}

export type EmployeeLifecycleState = Exclude<
  Awaited<ReturnType<typeof getEmployeeLifecycleState>>,
  Error
>
