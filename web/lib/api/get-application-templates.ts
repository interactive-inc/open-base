import { createClient } from "@/lib/api/hc-client"

/** GET /application-templates。任意で category で絞り込む申請テンプレ一覧。 */
export async function getApplicationTemplates(category: string | null) {
  const client = await createClient()

  const response = await client["company"]["application-templates"].$get({
    query: { category: category ?? undefined },
  })

  if (response.status >= 400) {
    return new Error("failed to load application templates")
  }

  const body = await response.json()

  return body.data
}
