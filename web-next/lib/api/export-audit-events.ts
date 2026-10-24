import { createClient } from "@/lib/api/hc-client"
import type { AuditExportRequest } from "@/lib/api/types/audit-types"

/** Returns the upstream response without consuming its CSV or error body. */
export async function exportAuditEvents(request: AuditExportRequest): Promise<Response> {
  const client = await createClient()
  return client["company"]["audit-event-exports"].$post(
    { json: request },
    { init: { cache: "no-store" } },
  )
}
