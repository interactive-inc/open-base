import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  ApplicationTemplateCreateRequest,
  ApplicationTemplateResponse,
} from "@/lib/api/types/application-template-types"

/** POST /application-templates。管理権限が申請テンプレートを作成する。 */
export async function createApplicationTemplate(
  request: ApplicationTemplateCreateRequest,
): Promise<ApplicationTemplateResponse | Error> {
  const client = await createClient()

  const response = await client["company"]["application-templates"].$post({
    json: {
      code: request.code,
      name: request.name,
      category: request.category,
      description: request.description ?? undefined,
      schema_json: request.schema_json,
      approver_roles: [...request.approver_roles],
    },
  })

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "申請テンプレートの作成に失敗しました",
      conflictMessages: {
        "template code already exists": "同じコードの申請テンプレートが既に存在します",
      },
    })
  }

  return response.json()
}
