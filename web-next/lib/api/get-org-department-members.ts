import { createClient } from "@/lib/api/hc-client"

/** GET /company/organization-units/:code/members を呼び、部署メンバー一覧を返す。 */
export async function getOrgDepartmentMembers(code: string) {
  const client = await createClient()

  const response = await client.company["organization-units"][":code"].members.$get({
    param: { code },
  })

  if (response.status >= 400) {
    return new Error("failed to load org department members")
  }

  return response.json()
}
