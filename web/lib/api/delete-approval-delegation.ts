import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

export async function deleteApprovalDelegation(id: EntityId) {
  const response = await (
    await createClient()
  ).company["approval-delegations"][":id"].$delete({ param: { id: String(id) } })
  if (response.status >= 400)
    return toResponseError(response, { fallback: "代理承認設定の削除に失敗しました" })
  return null
}
