import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export type CompanyPersonnelActionQuery = {
  id?: string
  employee_id?: string
  from?: string
  to?: string
  limit?: number
  cursor?: string
}

/** 確定した発令履歴と、現在の従業員名を読む。 */
export async function getCompanyPersonnelActions(query: CompanyPersonnelActionQuery = {}) {
  const client = await createClient()
  const response = await client.company["personnel-actions"].$get(
    {
      query: { ...query, limit: query.limit === undefined ? undefined : String(query.limit) },
    },
    { init: { cache: "no-store" } },
  )
  if (!response.ok) return toResponseError(response, { fallback: "人事発令の取得に失敗しました" })
  return response.json()
}
