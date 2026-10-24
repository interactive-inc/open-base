import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import { toStepUpHeaders } from "@/lib/api/to-step-up-headers"
import type { ApiResponseError } from "@/lib/api/api-response-error"

/**
 * DELETE /system/accounts/:accountId/role-bindings/:bindingId。System Role を剥奪する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function revokeAccountRole(
  accountId: string,
  bindingId: string,
  stepUpToken: string | null,
): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"]["role-bindings"][
    ":bindingId"
  ].$delete({ param: { accountId, bindingId } }, { headers: toStepUpHeaders(stepUpToken) })

  if (response.status !== 204) {
    return toApiResponseError(response, "failed to revoke role")
  }

  return null
}
