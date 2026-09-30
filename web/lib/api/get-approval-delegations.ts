import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function getApprovalDelegations() {
  const response = await (await createClient()).company["approval-delegations"].$get()
  if (response.status >= 400)
    return toResponseError(response, { fallback: "代理承認設定の取得に失敗しました" })
  return response.json()
}
