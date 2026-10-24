import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import { toStepUpHeaders } from "@/lib/api/to-step-up-headers"
import type { ApiResponseError } from "@/lib/api/api-response-error"

/**
 * POST /system/accounts/:accountId/role-bindings。System Role を付与する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function grantAccountRole(
  accountId: string,
  roleId: string,
  stepUpToken: string | null,
): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"]["role-bindings"].$post(
    {
      param: { accountId },
      json: { role_id: roleId, resource: null },
    },
    { headers: toStepUpHeaders(stepUpToken) },
  )

  if (response.status !== 201) {
    return toApiResponseError(response, "failed to grant role")
  }

  return null
}
