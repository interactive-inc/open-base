import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * PUT /application-requests/:id。申請内容（payload）を更新する。
 * 本人以外は 403、審査済みは 409 を api が返すため、戻りは Error になる。
 */
export async function updateApplication(id: EntityId, payload: unknown) {
  const client = await createClient()

  const response = await client["company"]["application-requests"][":id"].$put({
    param: { id: String(id) },
    json: { payload: payload },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請の変更に失敗しました",
      conflictMessages: {
        "application is already decided": "この申請は既に審査済みのため変更できません",
      },
    })
  }

  return response.json()
}
