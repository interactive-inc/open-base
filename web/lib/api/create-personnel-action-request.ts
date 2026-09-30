import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function createPersonnelActionRequest(request: Record<string, unknown>) {
  const client = await createClient()
  const endpoint = client.company["personnel-action-requests"].$post
  type RequestJson = Parameters<typeof endpoint>[0]["json"]
  const response = await endpoint(
    { json: request as RequestJson },
    { headers: { "Idempotency-Key": crypto.randomUUID() }, init: { cache: "no-store" } },
  )
  if (!response.ok) {
    return toResponseError(response, { fallback: "人事変更の申請に失敗しました" })
  }
  return response.json()
}
