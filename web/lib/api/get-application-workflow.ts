import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function getApplicationWorkflow(code: string) {
  const client = await createClient()
  const response = await client["company"]["application-templates"][":code"].workflow.$get({
    param: { code },
  })
  if (response.status >= 400) {
    return toResponseError(response, { fallback: "承認フローの取得に失敗しました" })
  }
  return response.json()
}
