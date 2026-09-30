import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import type { AuditEventPage, AuditListQuery } from "@/lib/api/types/audit-types"
import type { ApiResponseError } from "@/lib/api/api-response-error"

export async function getAuditEvents(
  query: AuditListQuery,
): Promise<AuditEventPage | ApiResponseError> {
  const client = await createClient()
  const response = await client["company"]["audit-events"].$get(
    { query },
    { init: { cache: "no-store" } },
  )

  if (response.status >= 400) {
    return toApiResponseError(response, "監査ログを取得できませんでした")
  }

  return response.json()
}
