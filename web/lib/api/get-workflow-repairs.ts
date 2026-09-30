import type { EntityId } from "@/lib/api/types/entity-id"
import { createClient } from "@/lib/api/hc-client"
import { toApiResponseError } from "@/lib/api/to-api-response-error"

export type WorkflowRepair = {
  id: EntityId
  template_code: string
  template_name: string
  applicant_name: string | null
  step_key: string
  round: number
  reason: "snapshot_missing" | "inactive_candidates"
  started_at: string
}

export type WorkflowRepairList = {
  data: ReadonlyArray<WorkflowRepair>
  total: number
}

/** GET /application-requests/workflow-repairs。修復権限は API が二重 permission で検査する。 */
export async function getWorkflowRepairs(
  params: { limit?: number; offset?: number } = {},
): Promise<WorkflowRepairList | Error> {
  const client = await createClient()
  const response = await client["company"]["application-requests"]["workflow-repairs"].$get({
    query: {
      limit: params.limit === undefined ? undefined : String(params.limit),
      offset: params.offset === undefined ? undefined : String(params.offset),
    },
  })

  if (response.status >= 400) {
    return toApiResponseError(response, "承認フローの修復対象を取得できませんでした")
  }

  return response.json()
}
