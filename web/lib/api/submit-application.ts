import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type { ApplicationSubmitRequest } from "@/lib/api/types/application-types"

/** POST /application-requests。テンプレコードと payload で申請を提出し、作成された詳細を返す。 */
export async function submitApplication(body: ApplicationSubmitRequest) {
  const client = await createClient()

  const response = await client["company"]["application-requests"].$post({ json: body })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "申請の提出に失敗しました" })
  }

  return response.json()
}
