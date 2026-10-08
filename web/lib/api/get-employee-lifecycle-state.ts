import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function getEmployeeLifecycleState(code: string, asOf?: string) {
  const client = await createClient()
  const response = await client.company["employee-lifecycle"][":code"].state.$get(
    { param: { code }, query: { as_of: asOf } },
    { init: { cache: "no-store" } },
  )
  if (!response.ok) {
    return toResponseError(response, { fallback: "在籍状況を読み込めませんでした" })
  }
  return response.json()
}

export type EmployeeLifecycleState = Exclude<
  Awaited<ReturnType<typeof getEmployeeLifecycleState>>,
  Error
>
