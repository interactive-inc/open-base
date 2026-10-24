import { createClient } from "@/lib/api/hc-client"
import type { SystemPrincipal } from "@/lib/api/types/system-operation-types"

/** GET /system/principals/:principalId。1 件の Principal を返す。 */
export async function getSystemPrincipal(principalId: string): Promise<SystemPrincipal | Error> {
  const client = await createClient()

  const response = await client.system.principals[":principalId"].$get({
    param: { principalId },
  })

  if (response.status >= 400) {
    return new Error("failed to load system principal")
  }

  const body = await response.json()

  return {
    id: body.principal.id,
    account_id: body.principal.account_id,
    kind: body.principal.kind,
    name: body.principal.name,
    connector_id: body.principal.connector_id,
    revision: body.principal.revision,
    created_at: body.principal.created_at,
    updated_at: body.principal.updated_at,
  }
}
