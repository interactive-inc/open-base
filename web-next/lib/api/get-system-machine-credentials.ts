import { createClient } from "@/lib/api/hc-client"
import type { SystemMachineCredential } from "@/lib/api/types/system-operation-types"

/**
 * GET /system/principals/:principalId/machine-credentials。
 * raw secret を含まない credential の metadata だけを返す。
 */
export async function getSystemMachineCredentials(
  principalId: string,
): Promise<ReadonlyArray<SystemMachineCredential> | Error> {
  const client = await createClient()

  const response = await client.system.principals[":principalId"]["machine-credentials"].$get({
    param: { principalId },
  })

  if (response.status >= 400) {
    return new Error("failed to load system machine credentials")
  }

  const body = await response.json()

  return body.credentials.map((credential) => ({
    id: credential.id,
    principal_id: credential.principal_id,
    name: credential.name,
    status: credential.status,
    created_at: credential.created_at,
    updated_at: credential.updated_at,
    expires_at: credential.expires_at,
    last_used_at: credential.last_used_at,
    revoked_at: credential.revoked_at,
  }))
}
