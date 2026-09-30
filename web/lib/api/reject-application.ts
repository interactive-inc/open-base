import type { EntityId } from "@/lib/api/types/entity-id"
import type { ApplicationDecisionTarget } from "@/lib/api/types/application-types"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/** 確認した提案版と判断段階へ否認を送る。 */
export async function rejectApplication(
  id: EntityId,
  comment: string,
  decisionTarget: ApplicationDecisionTarget,
) {
  const client = await createClient()

  const response = await client["company"]["application-requests"][":id"].reject.$post({
    param: { id: String(id) },
    json: { comment, decision_target: decisionTarget },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請の却下に失敗しました",
      conflictMessages: {
        "application decision target changed":
          "申請内容または承認段階が更新されています。詳細を再読み込みして確認してください",
        "already decided": "この申請は既に審査済みです",
      },
    })
  }

  return response.json()
}
