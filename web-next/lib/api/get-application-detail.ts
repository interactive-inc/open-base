import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { ApiResponseError } from "@/lib/api/api-response-error"

/** GET /application-requests/:id。申請 1 件の詳細（payload を含む）。 */
export async function getApplicationDetail(id: EntityId) {
  const client = await createClient()

  const response = await client["company"]["application-requests"][":id"].$get({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return new ApiResponseError(response.status, "failed to load application detail")
  }

  return response.json()
}
