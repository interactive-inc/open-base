import { createClient } from "@/lib/api/hc-client"
import type { OrgDepartmentResponse } from "@/lib/api/types/org-types"

/** GET /departments/:code。部署ノードを1件返す。不存在は api が 404 を返すため Error。 */
export async function getOrgDepartment(code: string): Promise<OrgDepartmentResponse | Error> {
  const client = await createClient()

  const response = await client.company["organization-units"][":code"].$get({
    param: { code },
  })

  if (response.status >= 400) {
    return new Error("failed to load org department")
  }

  return response.json()
}
