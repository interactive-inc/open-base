import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import { toStepUpHeaders } from "@/lib/api/to-step-up-headers"
import type { ApiResponseError } from "@/lib/api/api-response-error"

/**
 * PATCH /system/accounts/:accountId/password-credentials。パスワードを再設定する。
 * API が再認証 grant を要求するため、あれば `x-system-step-up` として送る。
 */
export async function resetAccountPassword(
  accountId: string,
  newPassword: string,
  stepUpToken: string | null,
): Promise<null | ApiResponseError> {
  const client = await createClient()

  const response = await client.system.accounts[":accountId"]["password-credentials"].$patch(
    {
      param: { accountId },
      json: { password: newPassword },
    },
    { headers: toStepUpHeaders(stepUpToken) },
  )

  if (response.status !== 204) {
    return toApiResponseError(response, "failed to reset password")
  }

  return null
}
