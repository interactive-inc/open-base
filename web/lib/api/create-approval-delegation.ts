import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function createApprovalDelegation(request: {
  delegate_employee_code: string
  template_code: string | null
  starts_at: string
  ends_at: string
}) {
  const response = await (
    await createClient()
  ).company["approval-delegations"].$post({
    json: request,
  })
  if (response.status >= 400)
    return toResponseError(response, { fallback: "代理承認設定の作成に失敗しました" })
  return response.json()
}
