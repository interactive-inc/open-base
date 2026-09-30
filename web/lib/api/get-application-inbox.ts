import { createClient } from "@/lib/api/hc-client"

export type ApplicationInboxSort = "created_at_desc" | "created_at_asc"

type Params = {
  limit?: number
  offset?: number
  sort?: ApplicationInboxSort
}

/** GET /application-requests/inbox。承認者向けの承認待ち申請一覧。data と total を併せて返す。 */
export async function getApplicationInbox(params: Params = {}) {
  const client = await createClient()

  const response = await client["company"]["application-requests"].inbox.$get({
    query: {
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
      sort: params.sort,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load application inbox")
  }

  return response.json()
}
