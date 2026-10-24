import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  OrgDepartmentMutationResponse,
  OrgDepartmentUpdateRequest,
} from "@/lib/api/types/org-types"

/**
 * PUT /departments/:code。部署ノードの親・責任者・表示順を変更する。
 * 権限不足は 403、不存在は 404、自身を親にすると 409 を api が返すため Error。
 */
export async function updateOrgDepartment(
  code: string,
  request: OrgDepartmentUpdateRequest,
): Promise<OrgDepartmentMutationResponse | Error> {
  const client = await createClient()

  const response = await client.company["organization-units"][":code"].$put(
    { param: { code }, json: request },
    { headers: { "Idempotency-Key": crypto.randomUUID() } },
  )

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "部署を変更できませんでした",
      conflictMessages: {
        "circular reference detected in department hierarchy":
          "部署の階層が循環するため変更できません。",
        "a department cannot be its own parent": "部署を自分自身の上位部署にはできません。",
      },
    })
  }

  return response.json()
}
