import { createClient } from "@/lib/api/hc-client"
import type { ApplicationStatus } from "@/lib/api/types/application-types"

export type ApplicationAdminSort = "created_at_desc" | "created_at_asc"

export type ApplicationAdminFilter = {
  status: ApplicationStatus | null
  applicantId: string | null
  templateCode: string | null
  from: string | null
  to: string | null
}

type Params = {
  limit?: number
  offset?: number
  sort?: ApplicationAdminSort
}

/**
 * GET /application-requests/admin。全社の申請を横断で取得する管理画面向け一覧。
 * application:read:all を持たない場合はサーバが 403 を返す。
 */
export async function getApplicationAdminList(filter: ApplicationAdminFilter, params: Params = {}) {
  const client = await createClient()

  const response = await client["company"]["application-requests"].admin.$get({
    query: {
      status: filter.status ?? undefined,
      applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
      template_code: filter.templateCode ?? undefined,
      from: filter.from ?? undefined,
      to: filter.to ?? undefined,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
      offset: params.offset !== undefined ? String(params.offset) : undefined,
    },
  })

  if (response.status >= 400) {
    return new Error("failed to load application admin list")
  }

  return response.json()
}
