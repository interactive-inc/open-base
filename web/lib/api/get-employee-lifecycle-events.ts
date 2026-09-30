import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function getEmployeeLifecycleEvents(
  code: string,
  query: { from?: string; to?: string; limit?: number; cursor?: string } = {},
) {
  const client = await createClient()
  const response = await client.company["employee-lifecycle"][":code"].events.$get(
    {
      param: { code },
      query: {
        from: query.from,
        to: query.to,
        limit: query.limit === undefined ? undefined : String(query.limit),
        cursor: query.cursor,
      },
    },
    { init: { cache: "no-store" } },
  )
  if (!response.ok) {
    return toResponseError(response, { fallback: "人事タイムラインの取得に失敗しました" })
  }
  return response.json()
}

export type EmployeeLifecycleEvents = Exclude<
  Awaited<ReturnType<typeof getEmployeeLifecycleEvents>>,
  Error
>
