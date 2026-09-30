import { createClient } from "@/lib/api/hc-client"

/**
 * GET /application-requests?scope=department。指定部署の所属メンバー全員の申請を取得する。
 * application:read:all、または本人が所属する部署への application:read:department が無いと api が 403 を返す。
 */
export async function getDepartmentApplications(departmentCode: string) {
  const client = await createClient()

  const response = await client["company"]["application-requests"].$get({
    query: {
      scope: "department",
      department_code: departmentCode,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load department applications")
  }

  const body = await response.json()

  return body.data
}
