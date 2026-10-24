import { createClient } from "@/lib/api/hc-client"
import type { SystemPrincipal } from "@/lib/api/types/system-operation-types"

/** GET /system/principals。Account と独立した Principal の分類を返す。 */
export async function getSystemPrincipals(): Promise<ReadonlyArray<SystemPrincipal> | Error> {
  const client = await createClient()

  const response = await client.system.principals.$get()

  if (response.status >= 400) {
    return new Error("failed to load system principals")
  }

  const body = await response.json()

  return body.principals.map(toPrincipal)
}

function toPrincipal(principal: SystemPrincipal): SystemPrincipal {
  return {
    id: principal.id,
    account_id: principal.account_id,
    kind: principal.kind,
    name: principal.name,
    connector_id: principal.connector_id,
    revision: principal.revision,
    created_at: principal.created_at,
    updated_at: principal.updated_at,
  }
}
