import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  ApplicationTemplateResponse,
  ApplicationTemplateUpdateRequest,
} from "@/lib/api/types/application-template-types"

/**
 * PUT /application-templates/:code。管理権限が申請テンプレートの内容を変更する。
 * 権限不足は 403、不存在は 404 を api が返すため、戻りは Error になる。
 */
export async function updateApplicationTemplate(
  code: string,
  request: ApplicationTemplateUpdateRequest,
): Promise<ApplicationTemplateResponse | Error> {
  const client = await createClient()

  const response = await client["company"]["application-templates"][":code"].$put({
    param: { code: code },
    json: {
      name: request.name,
      category: request.category,
      description: request.description ?? undefined,
      schema_json: request.schema_json,
      approver_roles: [...request.approver_roles],
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, { fallback: "申請テンプレートの変更に失敗しました" })
  }

  return response.json()
}
