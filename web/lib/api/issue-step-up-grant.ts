import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"
import type { ApiResponseError } from "@/lib/api/api-response-error"

type StepUpGrant = {
  stepUpToken: string
  expiresAt: string
}

/**
 * POST /system/step-up-grants。現在のアカウントのパスワードを再検証し、短命な再認証 grant を得る。
 * パスワードは戻り値にも例外にも載せない。
 */
export async function issueStepUpGrant(password: string): Promise<StepUpGrant | ApiResponseError> {
  const client = await createClient()

  const response = await client.system["step-up-grants"].$post({
    json: { method: "password", password: password },
  })

  if (response.status !== 201) {
    return toApiResponseError(response, "再認証に失敗しました")
  }

  const grant = await response.json()

  return { stepUpToken: grant.step_up_token, expiresAt: grant.expires_at }
}
