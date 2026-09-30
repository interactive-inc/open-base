import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function applyPersonnelAction(
  request: Record<string, unknown>,
  idempotencyKey: string,
) {
  const client = await createClient()
  const endpoint = client.company["personnel-action-executions"].$post
  type RequestJson = Parameters<typeof endpoint>[0]["json"]
  const response = await endpoint(
    { json: request as RequestJson },
    { headers: { "Idempotency-Key": idempotencyKey }, init: { cache: "no-store" } },
  )
  if (!response.ok) {
    return toResponseError(response, { fallback: "人事発令の確定に失敗しました" })
  }
  return response.json()
}
