import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import type { AuditEventDetail } from "@/lib/api/types/audit-types"
import type { ApiResponseError } from "@/lib/api/api-response-error"

export async function getAuditEvent(eventId: string): Promise<AuditEventDetail | ApiResponseError> {
  const client = await createClient()
  const response = await client["company"]["audit-events"][":eventId"].$get(
    { param: { eventId: eventId } },
    { init: { cache: "no-store" } },
  )

  if (response.status >= 400) {
    return toApiResponseError(response, "監査イベントを取得できませんでした")
  }

  return response.json()
}
