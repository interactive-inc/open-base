import type { OrgDepartmentEditExpectation } from "@/lib/api/types/org-types"
import { createClient } from "@/lib/api/hc-client"
import { toResponseError } from "@/lib/api/to-response-error"

/**
 * DELETE /departments/:code。部署ノードを削除する。
 * 権限不足は 403、不存在は 404、子や所属が残る場合は 409 を api が返すため Error。成功時は null。
 */
export async function deleteOrgDepartment(
  code: string,
  expectation: OrgDepartmentEditExpectation,
): Promise<null | Error> {
  const client = await createClient()

  const response = await client.company["organization-units"][":code"].$delete(
    { param: { code }, json: expectation },
    { headers: { "Idempotency-Key": crypto.randomUUID() } },
  )

  if (response.status >= 400) {
    return toResponseError(response, {
      fallback: "部署の削除に失敗しました",
      conflictMessages: {
        "department has children or members": "子部署または所属者が残っているため削除できません",
      },
    })
  }

  return null
}
