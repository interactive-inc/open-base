import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /application-templates/:code。管理権限が申請テンプレートを削除する。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。成功時は null。
 */
export async function deleteApplicationTemplate(code: string): Promise<null | Error> {
  const client = await createClient()

  const response = await client["company"]["application-templates"][":code"].$delete({
    param: { code: code },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請テンプレートの削除に失敗しました",
      conflictMessages: {
        "template is in use by pending applications":
          "審査中の申請で使用されているため削除できません",
      },
    })
  }

  return null
}
