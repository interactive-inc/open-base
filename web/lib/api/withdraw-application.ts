import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /application-requests/:id。申請を取り下げる。
 * 本人以外は 403、審査済みは 409 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function withdrawApplication(id: EntityId): Promise<null | Error> {
  const client = await createClient()

  const response = await client["company"]["application-requests"][":id"].$delete({
    param: { id: String(id) },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請の取り下げに失敗しました",
      conflictMessages: {
        "application is already decided": "この申請は既に審査済みのため取り下げできません",
      },
    })
  }

  return null
}
