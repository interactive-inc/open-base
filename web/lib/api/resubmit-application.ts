import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function resubmitApplication(id: EntityId, payload: unknown) {
  const client = await createClient()
  const response = await client["company"]["application-requests"][":id"].resubmit.$post({
    param: { id: String(id) },
    json: { payload },
  })
  if (response.status >= 400) {
    return toResponseError(response, { fallback: "申請の再提出に失敗しました" })
  }
  return response.json()
}
