import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import { toStepUpHeaders } from "@/lib/api/to-step-up-headers"
import type { ApiResponseError } from "@/lib/api/api-response-error"

/**
 * PATCH /system/accounts/:accountId。System Account の状態を変更する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function setAccountStatus(
  accountId: string,
  status: "active" | "suspended" | "locked",
  stepUpToken: string | null,
): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"].$patch(
    {
      param: { accountId },
      json: { status: status },
    },
    { headers: toStepUpHeaders(stepUpToken) },
  )

  if (response.status !== 200) {
    return toApiResponseError(response, "failed to set account status")
  }

  return null
}
