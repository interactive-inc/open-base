import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"
import type {
  OrgDepartmentCreateRequest,
  OrgDepartmentMutationResponse,
} from "@/lib/api/types/org-types"

/** POST /departments。部署ノードを作成する。権限不足は 403、コード重複は 409 で Error。 */
export async function createOrgDepartment(
  request: OrgDepartmentCreateRequest,
): Promise<OrgDepartmentMutationResponse | Error> {
  const client = await createClient()

  const response = await client.company["organization-units"].$post(
    { json: request },
    { headers: { "Idempotency-Key": crypto.randomUUID() } },
  )

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "部署の作成に失敗しました",
      conflictMessages: {
        "department code already exists": "この部署コードは既に存在します",
      },
    })
  }

  return response.json()
}
