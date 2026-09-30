import { createClient } from "@/lib/api/hc-client"

/**
 * GET /company/my-departments。本人が現に所属する部署の一覧（主配属を先頭、以降は兼務）。
 * サイドバーの部署タブなど補助表示に使うため、失敗時は Error を返して呼び出し側で空配列へ落とす。
 */
export async function getMyDepartments() {
  const client = await createClient()

  const response = await client.company["my-organization-units"].$get()

  if (response.status >= 400) {
    return new Error("failed to load my departments")
  }

  const body = await response.json()

  return body.data
}
